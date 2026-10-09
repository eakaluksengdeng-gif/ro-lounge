import type { Room } from "colyseus.js";
import type { ApiError, CasinoEntry, GuestReady, PrivateHand, TableState, WalletView, Card } from "../../../shared/pokdeng";
import { CASINO_DOOR } from "../../../shared/casinoWorld";
import { SERVER_URL } from "../net";
import type { TownScene } from "../scenes/TownScene";
import { joinPokTable, sendPok } from "./connect";
import "./casino.css";

const ERRORS: Record<string, string> = {
  INSUFFICIENT_CHIPS: "ชิปที่ใช้ได้ไม่พอ ต้องสำรองเงินทั้งลูกมือและเจ้ามือสูงสุด 5 เท่าของเดิมพัน",
  SEAT_TAKEN: "ที่นั่งนี้มีคนเลือกแล้ว", NO_DEALER: "รอคนเลือกที่นั่งเจ้ามือก่อน",
  DEALER_OFFLINE: "เจ้ามือหลุดจากโต๊ะ กรุณารอ", NO_BETS: "รอลูกมือลงเดิมพันก่อน",
  TABLE_FULL: "โต๊ะเต็มแล้ว ลองเข้าประตูใหม่", ALREADY_CONNECTED: "บัญชี Guest นี้อยู่ที่โต๊ะในอีกแท็บแล้ว",
  MUST_DRAW: "แต้มต่ำกว่า 4 ต้องจั่ว", INVALID_ENTRY: "ตั๋วเข้าห้องหมดอายุ ลองเข้าประตูใหม่",
  NOT_AT_DOOR: "เดินไปถึงประตูบ้านก่อน", BAD_BET: "กรุณาใส่เดิมพันเป็นจำนวนเต็มตั้งแต่ 10 ชิป",
  ROUND_ACTIVE: "รอรอบนี้จบก่อน", WRONG_ROUND: "รอบนี้จบแล้ว", ALREADY_ACTED: "เลือกไปแล้ว รอคนอื่น",
};
const PHASES = { betting: "เลือกที่นั่งและลงเดิมพัน", dealing: "กำลังแจกไพ่…", check_pok: "ตรวจป๊อก 8 / ป๊อก 9",
  action: "เลือกจั่วหรืออยู่", showdown: "เปิดไพ่และคิดชิป" };
const KINDS = { points: "แต้ม", pok8: "ป๊อก 8", pok9: "ป๊อก 9", sian: "เซียน", straight: "เรียง", tong: "ตอง" };

/** Presentation only. Wallet changes, seat admission and cards always come from the server. */
export class CasinoUI {
  private room?: Room;
  private table?: TableState;
  private hand?: PrivateHand;
  private playerId = "";
  private wallet?: WalletView;
  private joining = false;
  private leaving = false;
  private entry?: CasinoEntry;
  private clockOffset = 0;
  private modal = document.createElement("section");
  private heading = document.createElement("h2");
  private phase = document.createElement("p");
  private timer = document.createElement("span");
  private seats = document.createElement("div");
  private notice = document.createElement("p");
  private balance = document.createElement("span");
  private bet = document.createElement("input");
  private betButton = this.button("ลงเดิมพัน", () => this.send("game:bet", { amount: Number(this.bet.value) }));
  private cancel = this.button("ยกเลิกเดิมพัน", () => this.send("game:cancel_bet", {}));
  private start = this.button("เริ่มเกม", () => this.send("game:start", {}));
  private draw = this.button("จั่วไพ่", () => this.action("game:draw"));
  private stay = this.button("อยู่ / ผ่าน", () => this.action("game:stay"));
  private stand = this.button("ลุกจากที่นั่ง", () => this.send("table:stand", {}));
  private exit = this.button("ออกสู่เมือง", () => this.leave());
  private retry = this.button("กลับเข้าโต๊ะ", () => {
    if (this.entry) void this.enter({ ...this.entry, resumeRoomId: this.table?.roomId ?? this.entry.resumeRoomId });
  });

  constructor(private town: Room, private scene: TownScene, private name: string) {
    const toolbar = document.createElement("div");
    toolbar.id = "casinoToolbar";
    this.balance.textContent = "ชิป: กำลังโหลด…";
    toolbar.append(this.balance, this.button("♠ ไปบ้านป๊อกเด้ง", () => {
      const p = this.town.state?.players?.get(this.town.sessionId);
      if (p && Math.hypot(p.x - CASINO_DOOR.x, p.y - CASINO_DOOR.y) <= CASINO_DOOR.radius) {
        this.town.send("casino:enter", {});
      } else {
        // Approach from below the fountain instead of walking through it.
        if (p) {
          this.scene.navigateTo([{ x: p.x, y: 576 }, { x: CASINO_DOOR.x, y: 576 }, { x: CASINO_DOOR.x, y: CASINO_DOOR.y }]);
        }
      }
    }));
    document.body.append(toolbar);
    this.modal.id = "casino";
    this.modal.hidden = true;
    this.modal.setAttribute("role", "dialog");
    this.modal.setAttribute("aria-modal", "true");
    this.modal.setAttribute("aria-label", "บ้านป๊อกเด้ง");
    this.heading.textContent = "♠ บ้านป๊อกเด้ง";
    const header = document.createElement("header");
    header.append(this.heading, this.exit);
    this.timer.id = "pokTimer";
    this.phase.id = "pokPhase";
    const status = document.createElement("div");
    status.className = "pok-status";
    status.append(this.phase, this.timer);
    this.seats.id = "pokSeats";
    const controls = document.createElement("div");
    controls.id = "pokControls";
    this.bet.type = "number";
    this.bet.min = "10";
    this.bet.step = "1";
    this.bet.value = "10";
    this.bet.setAttribute("aria-label", "จำนวนชิปเดิมพัน");
    controls.append(this.bet, this.betButton, this.cancel, this.start, this.draw, this.stay, this.stand, this.retry);
    this.notice.id = "pokNotice";
    this.notice.setAttribute("role", "status");
    const rules = document.createElement("p");
    rules.className = "pok-rules";
    rules.textContent = "ชิปเล่นฟรี ไม่มีเงินจริง • ขั้นต่ำ 10 • สำรองสูงสุด 5 เท่า • 2/3 เด้ง ×2/×3 · เซียน/เรียง ×3 · ตอง ×5 · ป๊อกชนะไพ่สามใบ · เสมอคืนชิป";
    const panel = document.createElement("div");
    panel.className = "pok-panel";
    panel.append(header, status, this.seats, controls, this.notice, rules);
    this.modal.append(panel);
    document.body.append(this.modal);
    this.town.onMessage<GuestReady>("auth:ready", guest => {
      this.playerId = guest.playerId;
      this.updateWallet(guest.wallet);
      this.town.send("casino:locate", {});
    });
    this.town.onMessage<WalletView>("wallet:update", wallet => this.updateWallet(wallet));
    this.town.onMessage("casino:door", () => {
      const p = this.town.state?.players?.get(this.town.sessionId);
      if (p && Math.hypot(p.x - CASINO_DOOR.x, p.y - CASINO_DOOR.y) <= CASINO_DOOR.radius) this.town.send("casino:enter", {});
    });
    this.town.onMessage<CasinoEntry>("casino:entered", entry => { void this.enter(entry); });
    this.town.onMessage<ApiError>("api:error", error => {
      if (!error.event.startsWith("fish:")) this.message(ERRORS[error.code] ?? error.message);
    });
    this.town.send("auth:sync", {});
    window.setInterval(() => {
      const deadline = this.table?.deadline;
      this.timer.textContent = deadline ? Math.max(0, Math.ceil((deadline - Date.now() - this.clockOffset) / 1000)) + " วินาที" : "";
    }, 200);
  }

  private button(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  private message(text: string) {
    this.notice.textContent = text;
    if (this.modal.hidden) {
      const status = document.getElementById("status");
      if (status) { status.textContent = text; status.style.display = "block"; }
    }
  }

  private async enter(entry: CasinoEntry) {
    if (this.joining || this.room) return;
    this.joining = true;
    this.scene.stopNavigation();
    this.leaving = false;
    this.entry = entry;
    this.modal.hidden = false;
    this.scene.casinoOpen = true;
    this.message("กำลังเข้าโต๊ะ…");
    this.render();
    try {
      const room = await joinPokTable(SERVER_URL, entry, this.name, {
        "auth:ready": guest => { this.playerId = guest.playerId; this.updateWallet(guest.wallet); },
        "wallet:update": wallet => this.updateWallet(wallet),
        "table:state": table => {
          // Drop an old private hand when a new round/reset arrives.
          if (this.hand?.roundId !== table.roundId) this.hand = undefined;
          this.table = table;
          this.clockOffset = table.serverTime - Date.now();
          this.render();
        },
        "game:hand": hand => { this.hand = hand; this.render(); },
        "api:error": error => this.message(ERRORS[error.code] ?? error.message),
      });
      this.room = room;
      this.message("เลือกที่นั่ง 0 เป็นเจ้ามือ หรือเลือกเก้าอี้ลูกมือ 1–7 แล้วลงเดิมพัน");
      room.onLeave(() => {
        if (this.room !== room) return;
        this.room = undefined;
        if (!this.leaving) this.message("หลุดจากโต๊ะ กดกลับเข้าโต๊ะภายใน 60 วินาที ไพ่และชิปที่เดิมพันยังอยู่");
        this.render();
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      this.message(ERRORS[code] ?? "เข้าโต๊ะไม่ได้ เซิร์ฟเวอร์อาจกำลังอัปเดต ลองออกแล้วเดินเข้าประตูใหม่");
    } finally {
      this.joining = false;
      this.render();
    }
  }

  private send<K extends Parameters<typeof sendPok>[1]>(event: K, payload: import("../../../shared/pokdeng").PokClientEvents[K]) {
    if (this.room) sendPok(this.room, event, payload);
  }
  private action(event: "game:draw" | "game:stay") {
    if (this.table?.roundId) this.send(event, { roundId: this.table.roundId });
  }
  private leave() {
    if (this.joining || (this.room && this.table?.phase !== "betting")) return;
    this.leaving = true;
    if (this.room) this.send("table:leave", {});
    const departed = this.room;
    this.modal.hidden = true;
    this.scene.casinoOpen = false;
    this.table = undefined;
    this.hand = undefined;
    // Step off the trigger, allowing the next doorway approach to emit a new entry.
    const stepOut = () => this.town.send("move", { x: CASINO_DOOR.x, y: CASINO_DOOR.y + 72 });
    // Town movement is frozen until the table acknowledges removal.
    if (departed) departed.onLeave(stepOut);
    else stepOut();
  }
  private updateWallet(wallet: WalletView) {
    this.wallet = wallet;
    this.balance.textContent = "ชิป " + wallet.balance + " · ใช้ได้ " + wallet.available + " · สำรอง " + wallet.reserved;
    this.render();
  }
  private card(card?: Card) {
    const el = document.createElement("span");
    el.className = card ? "pok-card" : "pok-card back";
    if (card) {
      const suits = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
      el.textContent = ({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[card.rank] ?? String(card.rank);
      el.append(document.createTextNode(suits[card.suit]));
      if (card.suit === "diamonds" || card.suit === "hearts") el.classList.add("red");
    } else { el.textContent = "♠"; el.setAttribute("aria-label", "ไพ่คว่ำ"); }
    return el;
  }
  private render() {
    const table = this.table;
    const me = table?.seats.find(seat => seat?.playerId === this.playerId);
    const betting = !!this.room && table?.phase === "betting";
    const dealer = table?.seats[0];
    this.phase.textContent = table ? PHASES[table.phase] + " · โต๊ะ " + table.roomId : "บ้านป๊อกเด้ง · 1–8 คน";
    this.exit.disabled = this.joining || (!!this.room && !betting);
    this.exit.title = betting ? "" : "รอคิดชิปและเริ่มช่วงเดิมพันก่อนออก";
    this.bet.hidden = this.betButton.hidden = this.cancel.hidden = !me || me.dealer || !betting;
    this.bet.min = String(table?.minBet ?? 10);
    this.bet.max = String(Math.floor(((this.wallet?.available ?? 0) + (me?.bet ?? 0) * (table?.maxMultiplier ?? 5)) / (table?.maxMultiplier ?? 5)));
    this.betButton.disabled = !dealer?.connected;
    this.cancel.disabled = !me?.bet;
    this.start.hidden = !me?.dealer || !betting;
    this.start.disabled = !table?.seats.some(seat => seat && seat.bet > 0 && seat.connected);
    this.stand.hidden = !me || !betting;
    this.draw.hidden = this.stay.hidden = table?.phase !== "action" || !me?.cardCount;
    const ownedHand = this.hand?.roundId === table?.roundId ? this.hand : undefined;
    this.draw.disabled = !this.room || !ownedHand?.canDraw;
    this.stay.disabled = !this.room || !ownedHand?.canStay;
    this.stay.title = ownedHand?.canDraw && !ownedHand.canStay ? "ต่ำกว่า 4 แต้ม ต้องจั่ว; หมดเวลาเซิร์ฟเวอร์จะจั่วให้" : "";
    this.retry.hidden = !!this.room || this.joining;
    this.seats.replaceChildren();
    for (let index = 0; index < 8; index++) {
      const seat = table?.seats[index];
      const el = document.createElement("article");
      el.className = "pok-seat" + (index === 0 ? " dealer" : "") + (seat?.playerId === this.playerId ? " mine" : "");
      const title = document.createElement("h3");
      title.textContent = index === 0 ? "♛ เจ้ามือ" : "ลูกมือ " + index;
      el.append(title);
      if (!seat) {
        const sit = this.button("นั่งที่นี่", () => this.send("table:sit", { seat: index }));
        sit.disabled = !betting || !!me;
        sit.dataset.seat = String(index);
        el.append(sit);
      } else {
        const name = document.createElement("p");
        name.textContent = seat.name + (seat.playerId === this.playerId ? " (คุณ)" : "") + (seat.connected ? "" : " · หลุด");
        const info = document.createElement("p");
        info.textContent = seat.dealer ? "เจ้ามือรับทุกเดิมพัน" : "เดิมพัน " + seat.bet + " ชิป";
        const cards = document.createElement("div");
        cards.className = "pok-cards";
        const visible = seat.cards ?? (seat.playerId === this.playerId ? ownedHand?.cards : undefined);
        for (let i = 0; i < seat.cardCount; i++) cards.append(this.card(visible?.[i]));
        const result = document.createElement("p");
        result.className = "pok-result";
        if (seat.value) result.textContent = (seat.value.kind === "points" ? seat.value.points + " แต้ม" : KINDS[seat.value.kind]) + " ×" + seat.value.multiplier;
        else if (seat.acted && table?.phase === "action") result.textContent = "เลือกแล้ว";
        const payout = seat.dealer && table?.phase === "showdown"
          ? { delta: -table.results.reduce((sum, item) => sum + item.delta, 0) }
          : table?.results.find(item => item.playerId === seat.playerId);
        if (payout) result.append(document.createTextNode(" · " + (payout.delta > 0 ? "+" : "") + payout.delta + " ชิป"));
        el.append(name, info, cards, result);
      }
      this.seats.append(el);
    }
  }
}
