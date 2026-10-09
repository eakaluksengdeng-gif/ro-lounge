import { randomUUID } from "node:crypto";
import type { Card, Phase, PrivateHand, RoundResult, TableState } from "../../../shared/pokdeng";
import { EconomyManager, type Reservation, type Settlement } from "../economy/EconomyManager";
import { DEFAULT_RULES, evaluate, isPok, maximumMultiplier, points, shuffledDeck, type Rules } from "./cards";
import { GameError, requireGame } from "./errors";

interface Member {
  id: string; name: string; seat: number | null; connected: boolean;
  expiresAt: number | null; bet: number; cards: Card[]; acted: boolean;
  repeatBet: number; leaving: boolean; betIssue: "player_chips" | "dealer_chips" | null;
}

export interface GameOptions {
  rules?: Rules;
  now?: () => number;
  deck?: () => Card[]; // Dependency injection for deterministic server tests, never a client option.
  onRemove?: (playerId: string) => void;
}

/** No Colyseus Schema contains these cards. Only snapshot()/privateHand() cross the wire. */
export class GameManager {
  readonly rules: Rules;
  private members = new Map<string, Member>();
  private seats: (string | null)[] = Array(8).fill(null);
  private phase: Phase = "betting";
  private deadline: number | null = null;
  private roundId: string | null = null;
  private participants: string[] = [];
  private deck: Card[] = [];
  private results: RoundResult[] = [];
  private autoPlay = false;
  private roundNumber = 0;
  private dirty = false;
  private now: () => number;
  private deckFactory: () => Card[];

  constructor(readonly roomId: string, private readonly economy: EconomyManager, private readonly options: GameOptions = {}) {
    this.rules = options.rules ?? DEFAULT_RULES;
    this.now = options.now ?? Date.now;
    this.deckFactory = options.deck ?? shuffledDeck;
    requireGame(Number.isSafeInteger(this.rules.minBet) && this.rules.minBet > 0, "BAD_RULES", "Invalid minimum bet");
    for (const multiplier of Object.values(this.rules.multipliers)) {
      requireGame(Number.isSafeInteger(multiplier) && multiplier >= 1, "BAD_RULES", "Invalid multiplier");
    }
    for (const strength of Object.values(this.rules.ranking)) {
      requireGame(Number.isSafeInteger(strength) && strength >= 0 && strength <= Number.MAX_SAFE_INTEGER - 9, "BAD_RULES", "Invalid hand ranking");
    }
    for (const duration of [this.rules.actionMs, this.rules.dealingMs, this.rules.checkPokMs, this.rules.showdownMs, this.rules.bettingMs, this.rules.reconnectMs]) {
      requireGame(Number.isSafeInteger(duration) && duration >= 0, "BAD_RULES", "Invalid duration");
    }
  }

  get size(): number { return this.members.size; }
  has(id: string): boolean { return this.members.has(id); }
  takeDirty(): boolean { const dirty = this.dirty; this.dirty = false; return dirty; }

  connect(id: string, name: string): void {
    const existing = this.members.get(id);
    requireGame(!existing?.connected, "ALREADY_CONNECTED", "This guest is already connected to the table");
    if (existing) {
      existing.connected = true;
      existing.expiresAt = null;
      existing.leaving = false;
    } else {
      requireGame(this.members.size < 8, "TABLE_FULL", "Table accepts at most eight guests");
      this.members.set(id, { id, name: name.slice(0, 16), seat: null, connected: true, expiresAt: null, bet: 0, cards: [], acted: false,
        repeatBet: 0, leaving: false, betIssue: null });
    }
    if (this.phase === "betting") this.restoreBets();
    this.dirty = true;
  }

  sit(id: string, seat: unknown): void {
    this.requireBetting();
    const member = this.member(id);
    requireGame(Number.isInteger(seat) && typeof seat === "number" && seat >= 0 && seat < 8, "BAD_SEAT", "Seat must be 0–7");
    requireGame(member.seat === null, "ALREADY_SEATED", "Stand before choosing another seat");
    requireGame(this.seats[seat] === null, "SEAT_TAKEN", "Seat is occupied");
    this.seats[seat] = id;
    member.seat = seat;
    if (seat === 0) this.restoreBets();
    this.dirty = true;
  }

  /** Accepting the dealer role is explicit: never silently assign another person's bankroll. */
  becomeDealer(id: string): void {
    this.requireBetting();
    requireGame(this.seats[0] === null, "SEAT_TAKEN", "Dealer seat is occupied");
    this.stand(id);
    this.sit(id, 0);
  }

  stand(id: string): void {
    this.requireBetting();
    const member = this.member(id);
    if (member.seat === 0) this.cancelAllBets();
    else this.cancelBet(id);
    if (member.seat !== null) this.seats[member.seat] = null;
    member.seat = null;
    member.repeatBet = 0;
    member.betIssue = null;
    this.updateCountdown();
    this.dirty = true;
  }

  bet(id: string, amount: unknown): void {
    this.requireBetting();
    const member = this.member(id);
    requireGame(member.seat !== null && member.seat !== 0, "NOT_PLAYER", "Only seated players may bet");
    const dealer = this.dealer();
    requireGame(dealer.connected, "DEALER_OFFLINE", "Dealer must be connected");
    requireGame(typeof amount === "number" && Number.isSafeInteger(amount) && amount >= this.rules.minBet, "BAD_BET", `Minimum bet is ${this.rules.minBet}`);
    const exposure = amount * maximumMultiplier(this.rules);
    requireGame(Number.isSafeInteger(exposure), "BAD_BET", "Bet is too large");
    const dealerExposure = [...this.members.values()].reduce((sum, m) => sum + (m.id === id ? amount : m.bet), 0) * maximumMultiplier(this.rules);
    this.economy.reserveBatch([
      { playerId: id, key: this.holdKey(id), amount: exposure },
      { playerId: dealer.id, key: this.holdKey(dealer.id), amount: dealerExposure },
    ]);
    member.bet = amount;
    member.repeatBet = amount;
    member.betIssue = null;
    this.updateCountdown();
    this.dirty = true;
  }

  cancelBet(id: string): void {
    this.requireBetting();
    const member = this.member(id);
    member.repeatBet = 0;
    member.betIssue = null;
    this.dirty = true;
    if (!member.bet) { this.updateCountdown(); return; }
    const dealer = this.dealer();
    const remaining = [...this.members.values()].reduce((sum, m) => sum + (m.id === id ? 0 : m.bet), 0);
    this.economy.reserveBatch([
      { playerId: id, key: this.holdKey(id), amount: 0 },
      { playerId: dealer.id, key: this.holdKey(dealer.id), amount: remaining * maximumMultiplier(this.rules) },
    ]);
    member.bet = 0;
    this.updateCountdown();
    this.dirty = true;
  }

  start(id: string): void {
    this.requireBetting();
    requireGame(this.dealer().id === id, "NOT_DEALER", "Only the dealer may start a round");
    requireGame(this.member(id).connected, "DEALER_OFFLINE", "Dealer must be connected");
    const bettors = [...this.members.values()].filter(m => m.bet > 0);
    requireGame(bettors.length > 0, "NO_BETS", "At least one player must bet");
    requireGame(bettors.every(m => m.connected), "PLAYER_OFFLINE", "All betting players must be connected");
    const deck = this.deckFactory();
    requireGame(deck.length === 52 && new Set(deck.map(c => `${c.rank}:${c.suit}`)).size === 52 &&
      deck.every(c => Number.isInteger(c.rank) && c.rank >= 1 && c.rank <= 13 && ["clubs", "diamonds", "hearts", "spades"].includes(c.suit)), "BAD_DECK", "Expected a complete unique deck");
    this.deck = deck.map(c => ({ ...c }));
    this.roundId = randomUUID();
    this.autoPlay = true;
    this.roundNumber++;
    this.results = [];
    this.participants = [id, ...bettors.map(m => m.id)];
    for (const member of this.members.values()) { member.cards = []; member.acted = false; }
    // Deal in two passes. All participants receive their own private two-card hand.
    for (let pass = 0; pass < 2; pass++) for (const pid of this.participants) this.members.get(pid)!.cards.push(this.drawCard());
    this.setPhase("dealing", this.rules.dealingMs);
  }

  draw(id: string, roundId: unknown): void {
    const member = this.requireAction(id, roundId);
    member.cards.push(this.drawCard());
    member.acted = true;
    this.dirty = true;
    this.finishActionsIfReady();
  }

  stay(id: string, roundId: unknown): void {
    const member = this.requireAction(id, roundId);
    requireGame(points(member.cards) >= 4, "MUST_DRAW", "Hands below four points must draw");
    member.acted = true;
    this.dirty = true;
    this.finishActionsIfReady();
  }

  disconnect(id: string): void {
    const member = this.members.get(id);
    if (!member) return;
    member.connected = false;
    member.expiresAt = this.now() + this.rules.reconnectMs;
    if (this.phase === "betting") {
      // A transport interruption cancels unbound holds, not the remembered stake.
      const remembered = member.repeatBet;
      if (member.seat === 0) this.cancelAllBets(); else this.cancelBet(id);
      member.repeatBet = remembered;
      this.updateCountdown();
    }
    this.dirty = true;
  }

  leave(id: string): void {
    if (!this.members.has(id)) return;
    if (this.phase !== "betting") {
      // Bets are binding until showdown even when someone closes the tab or voluntarily leaves.
      const member = this.member(id);
      member.leaving = true;
      member.repeatBet = 0;
      this.dirty = true;
      return;
    }
    this.stand(id);
    this.remove(id);
  }

  tick(): void {
    const now = this.now();
    if (this.deadline !== null && now >= this.deadline) {
      if (this.phase === "dealing") {
        for (const id of this.participants) this.members.get(id)!.acted = isPok(this.members.get(id)!.cards);
        this.setPhase("check_pok", this.rules.checkPokMs);
      } else if (this.phase === "check_pok") {
        if (isPok(this.dealer().cards)) this.settle();
        else {
          this.setPhase("action", this.rules.actionMs);
          this.finishActionsIfReady();
        }
      } else if (this.phase === "action") {
        for (const id of this.participants) {
          const member = this.members.get(id)!;
          if (!member.acted) {
            // Mandatory draw has precedence over auto-Stay at the deadline.
            if (points(member.cards) < 4) member.cards.push(this.drawCard());
            member.acted = true;
          }
        }
        this.settle();
      } else if (this.phase === "showdown") {
        for (const member of this.members.values()) { member.bet = 0; member.cards = []; member.acted = false; }
        this.participants = [];
        this.deck = [];
        this.results = [];
        this.roundId = null;
        this.phase = "betting";
        this.deadline = null;
        for (const member of [...this.members.values()]) {
          if (member.leaving || (!member.connected && member.expiresAt !== null && now >= member.expiresAt)) this.leave(member.id);
        }
        this.restoreBets();
        this.dirty = true;
      } else if (this.phase === "betting") {
        // Start once: subsequent rounds use only successfully reserved, consenting stakes.
        this.start(this.dealer().id);
      }
    }
    // Retain offline participants through payout. Clean up only once a table returns to betting.
    if (this.phase === "betting") for (const member of [...this.members.values()]) {
      if (!member.connected && member.expiresAt !== null && now >= member.expiresAt) this.leave(member.id);
    }
    if (this.phase === "betting") this.updateCountdown();
  }

  snapshot(): TableState {
    const revealPok = this.phase === "check_pok" || this.phase === "action";
    return {
      roomId: this.roomId, roundId: this.roundId, phase: this.phase,
      serverTime: this.now(), deadline: this.deadline, dealerSeat: 0,
      minBet: this.rules.minBet, maxMultiplier: maximumMultiplier(this.rules),
      autoPlay: this.autoPlay, roundNumber: this.roundNumber,
      seats: this.seats.map((id, seat) => {
        if (!id) return null;
        const m = this.members.get(id)!;
        const visible = m.cards.length > 0 && (this.phase === "showdown" || (revealPok && isPok(m.cards)));
        return {
          seat, playerId: id, name: m.name, connected: m.connected, dealer: seat === 0,
          bet: m.bet, cardCount: m.cards.length, acted: m.acted,
          repeatBet: m.repeatBet, leaving: m.leaving, betIssue: m.betIssue,
          ...(visible ? { cards: m.cards.map(c => ({ ...c })), value: evaluate(m.cards, this.rules) } : {}),
        };
      }),
      results: this.results.map(r => ({ ...r })),
    };
  }

  privateHand(id: string): PrivateHand {
    const member = this.members.get(id);
    const canDraw = !!member?.connected && !member.leaving && this.phase === "action" && this.participants.includes(id) && !member.acted && this.now() < this.deadline!;
    return {
      roundId: this.roundId, cards: member?.cards.map(c => ({ ...c })) ?? [],
      canDraw, canStay: canDraw && points(member!.cards) >= 4, deadline: this.deadline,
    };
  }

  dispose(): void {
    // Room/server shutdown aborts an unfinished round and releases all reservations.
    this.economy.reserveBatch([...this.members.keys()].map(id => ({ playerId: id, key: this.holdKey(id), amount: 0 })));
    for (const id of [...this.members.keys()]) this.remove(id);
  }

  private member(id: string): Member {
    const member = this.members.get(id);
    requireGame(member, "NOT_MEMBER", "Guest is not in this table");
    return member;
  }

  private dealer(): Member {
    const id = this.seats[0];
    requireGame(id, "NO_DEALER", "Choose a dealer before betting");
    return this.member(id);
  }

  private holdKey(id: string): string { return `pok:${this.roomId}:${id}`; }

  private requireBetting(): void { requireGame(this.phase === "betting", "ROUND_ACTIVE", "Wait until betting resumes"); }

  private requireAction(id: string, roundId: unknown): Member {
    requireGame(roundId === this.roundId && this.roundId !== null, "STALE_ROUND", "Round identifier does not match");
    requireGame(this.phase === "action" && this.deadline !== null && this.now() < this.deadline, "NOT_ACTION_PHASE", "Action window has ended or has not started");
    const member = this.member(id);
    requireGame(member.connected && !member.leaving && this.participants.includes(id) && !member.acted, "ACTION_NOT_ALLOWED", "Cannot act again or on another player's hand");
    return member;
  }

  private drawCard(): Card {
    const card = this.deck.shift();
    requireGame(card, "EMPTY_DECK", "Deck is empty");
    return card;
  }

  private setPhase(phase: Phase, ms: number): void {
    this.phase = phase;
    this.deadline = this.now() + ms;
    this.dirty = true;
  }

  private finishActionsIfReady(): void {
    if (this.participants.every(id => this.members.get(id)!.acted)) this.settle();
  }

  private settle(): void {
    requireGame(this.roundId !== null, "NO_ROUND", "No round to settle");
    const dealer = this.dealer();
    const dealerValue = evaluate(dealer.cards, this.rules);
    const results: RoundResult[] = [];
    const entries: Settlement[] = [];
    let dealerDelta = 0;
    for (const id of this.participants) {
      if (id === dealer.id) continue;
      const player = this.member(id);
      const value = evaluate(player.cards, this.rules);
      const comparison = Math.sign(value.strength - dealerValue.strength);
      const multiplier = comparison === 0 ? 0 : comparison > 0 ? value.multiplier : dealerValue.multiplier;
      const delta = comparison * player.bet * multiplier;
      dealerDelta -= delta;
      results.push({ playerId: id, outcome: comparison > 0 ? "win" : comparison < 0 ? "lose" : "tie", delta, multiplier });
      entries.push({ playerId: id, key: this.holdKey(id), delta });
    }
    entries.push({ playerId: dealer.id, key: this.holdKey(dealer.id), delta: dealerDelta });
    this.economy.settle(this.roundId, entries);
    this.results = results;
    this.setPhase("showdown", this.rules.showdownMs);
  }

  private cancelAllBets(): void {
    const reservations: Reservation[] = [...this.members.values()].filter(m => m.bet > 0 || m.seat === 0)
      .map(m => ({ playerId: m.id, key: this.holdKey(m.id), amount: 0 }));
    this.economy.reserveBatch(reservations);
    for (const member of this.members.values()) member.bet = 0;
    this.updateCountdown();
    this.dirty = true;
  }

  private restoreBets(): void {
    const dealerId = this.seats[0];
    if (!this.autoPlay || !dealerId || !this.members.get(dealerId)?.connected) return;
    for (const member of this.members.values()) {
      if (member.seat === null || member.seat === 0 || !member.connected || member.leaving || member.bet || !member.repeatBet) continue;
      const amount = member.repeatBet;
      try { this.bet(member.id, amount); }
      catch (error) {
        if (!(error instanceof GameError) || error.code !== "INSUFFICIENT_CHIPS") throw error;
        member.betIssue = this.economy.view(member.id).available < amount * maximumMultiplier(this.rules) ? "player_chips" : "dealer_chips";
        // Pause this player's automatic stake until they explicitly bet again.
        member.repeatBet = 0;
        this.dirty = true;
      }
    }
    this.updateCountdown();
  }

  private updateCountdown(): void {
    if (this.phase !== "betting") return;
    const dealerId = this.seats[0];
    const ready = this.autoPlay && dealerId && this.members.get(dealerId)?.connected &&
      [...this.members.values()].some(member => member.bet > 0 && member.connected && !member.leaving);
    if (ready && this.deadline === null) { this.deadline = this.now() + this.rules.bettingMs; this.dirty = true; }
    else if (!ready && this.deadline !== null) { this.deadline = null; this.dirty = true; }
  }

  private remove(id: string): void {
    const member = this.members.get(id)!;
    if (member.seat !== null) this.seats[member.seat] = null;
    this.members.delete(id);
    this.options.onRemove?.(id);
    this.dirty = true;
  }
}
