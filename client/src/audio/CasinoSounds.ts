import type { PrivateHand, SeatView, TableState } from "../../../shared/pokdeng";
import { gameSounds, type SoundCue } from "./GameSounds";

/** State-edge cues only. Never inspects another guest's private hand or replays snapshots on resume. */
export class CasinoSounds {
  private previous?: Pick<TableState, "roomId" | "roundId" | "phase"> & {
    seats: (Pick<SeatView, "playerId" | "bet" | "cardCount" | "acted"> | null)[];
  };
  private pokRound?: string | null;
  private tickRound?: string | null;
  private ticks = new Set<number>();
  constructor(private play: (cue: SoundCue, delay?: number) => unknown = (cue, delay) => gameSounds.play(cue, delay)) {}
  reset() { this.previous = undefined; this.pokRound = undefined; this.tickRound = undefined; this.ticks.clear(); }
  update(table: TableState, playerId: string) {
    const old = this.previous;
    // Cache only public primitive counters/flags; no card faces, deep-clone API or private hand data.
    this.previous = { roomId: table.roomId, roundId: table.roundId, phase: table.phase,
      seats: table.seats.map(seat => seat ? { playerId: seat.playerId, bet: seat.bet, cardCount: seat.cardCount, acted: seat.acted } : null) };
    if (!old || old.roomId !== table.roomId) {
      // A resumed snapshot is not a fresh deal/Pok/win, even if the whole hand is visible.
      if (table.seats.some(seat => seat?.value?.kind === "pok8" || seat?.value?.kind === "pok9")) this.pokRound = table.roundId;
      return;
    }
    const cards = table.seats.reduce((sum, seat) => sum + (seat?.cardCount ?? 0), 0);
    const oldCards = old.seats.reduce((sum, seat) => sum + (seat?.cardCount ?? 0), 0);
    if ((table.roundId !== old.roundId || oldCards === 0) && cards > 0) {
      for (let i = 0; i < Math.min(cards, 16); i++) this.play("deal", i * .075);
    } else if (table.roundId === old.roundId && cards > oldCards) this.play("draw");
    const me = table.seats.find(seat => seat?.playerId === playerId);
    const oldMe = old.seats.find(seat => seat?.playerId === playerId);
    if (me && !oldMe) this.play("enter");
    if (!me && oldMe) this.play("exit");
    if (table.phase === "betting" && me && oldMe && !me.dealer && me.bet !== oldMe.bet) this.play(me.bet > 0 ? "bet" : "cancel");
    if (table.phase === "action" && me?.acted && !oldMe?.acted && me.cardCount === oldMe?.cardCount) this.play("stay");
    if (table.roundId && this.pokRound !== table.roundId && table.phase !== "dealing" && table.phase !== "betting") {
      // Only public HandValue values sent by the server may announce a Pok to the table.
      const kinds = table.seats.map(seat => seat?.value?.kind);
      if (kinds.includes("pok9") || kinds.includes("pok8")) {
        this.pokRound = table.roundId;
        this.play(kinds.includes("pok9") ? "pok9" : "pok8", .1);
      }
    }
    if (table.phase === "showdown" && (old.phase !== "showdown" || old.roundId !== table.roundId)) {
      this.play("reveal");
      if (me?.cardCount) {
        const delta = me.dealer ? -table.results.reduce((sum, item) => sum + item.delta, 0)
          : table.results.find(item => item.playerId === playerId)?.delta;
        if (delta !== undefined) this.play(delta > 0 ? "win" : delta < 0 ? "lose" : "tie", .45);
      }
    }
  }
  tick(table: TableState | undefined, hand: PrivateHand | undefined, remaining: number) {
    if (!table?.roundId || table.phase !== "action" || hand?.roundId !== table.roundId || !hand.canDraw && !hand.canStay) return;
    if (this.tickRound !== table.roundId) { this.tickRound = table.roundId; this.ticks.clear(); }
    if (remaining > 0 && remaining <= 3 && !this.ticks.has(remaining)) { this.ticks.add(remaining); this.play("tick"); }
  }
}
