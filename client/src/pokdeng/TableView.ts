import type { Card, PrivateHand, SeatView, TableState } from "../../../shared/pokdeng";
import { coinAmount, goldCoin, playingCard } from "./PixelCards";

const KINDS = { points: "แต้ม", pok8: "ป๊อก 8", pok9: "ป๊อก 9", sian: "เซียน", straight: "เรียง", tong: "ตอง" };
const PHASES = { betting: "รอเดิมพัน", dealing: "กำลังแจกไพ่", check_pok: "ตรวจป๊อก", action: "จั่ว หรือ อยู่", showdown: "เปิดไพ่ · คิดชิปแล้ว" };

/** Stable card slots: unrelated state/wallet messages must not replay dealing or reveal a hidden hand. */
export class AnimatedCards {
  private key = "";
  private slots: { node: HTMLSpanElement; face: string }[] = [];

  constructor(private element: HTMLElement, private source: () => HTMLElement | undefined, private large = false) {}

  render(key: string, cards: Card[] | undefined, count: number) {
    if (key !== this.key) {
      this.key = key;
      this.slots = [];
      this.element.replaceChildren();
    }
    while (this.slots.length > count) this.slots.pop()!.node.remove();
    const arrivals: { node: HTMLElement; index: number; kind: "deal" | "draw" }[] = [];
    for (let i = 0; i < count; i++) {
      const card = cards?.[i];
      const face = card ? card.rank + ":" + card.suit : "back";
      let slot = this.slots[i];
      const isNew = !slot;
      if (!slot) {
        const node = document.createElement("span");
        node.className = "pok-card-slot";
        slot = { node, face: "" };
        this.slots.push(slot);
        this.element.append(node);
      }
      const angle = (i - (count - 1) / 2) * (this.large ? 13 : 8);
      slot.node.style.setProperty("--fan-angle", angle + "deg");
      slot.node.style.setProperty("--fan-lift", Math.abs(i - (count - 1) / 2) * (this.large ? 9 : 3) + "px");
      if (slot.face !== face) {
        const previous = slot.face;
        slot.face = face;
        const picture = playingCard(card, this.large);
        slot.node.replaceChildren(picture);
        // Front faces exist only when this client actually received them from the server.
        if (!isNew && previous === "back" && card) this.flip(picture);
      }
      if (isNew) arrivals.push({ node: slot.node, index: i, kind: count === 3 && i === 2 ? "draw" : "deal" });
    }
    this.element.dataset.cardCount = String(count);
    // Measure after the entire fan is laid out, so each trajectory starts at the actual deck.
    for (const arrival of arrivals) this.deal(arrival.node, arrival.index, arrival.kind);
  }

  private motion(element: HTMLElement, kind: string, frames: Keyframe[], options: KeyframeAnimationOptions) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.dataset.motion = kind;
    element.dataset.motionCount = String(Number(element.dataset.motionCount ?? 0) + 1);
    // Cancel superseded visual effects, never delay/override any server action.
    element.getAnimations().forEach(animation => animation.cancel());
    element.animate(frames, options);
  }

  private deal(node: HTMLElement, index: number, kind: "deal" | "draw") {
    const from = this.source()?.getBoundingClientRect();
    const to = node.getBoundingClientRect();
    const dx = from ? from.x + from.width / 2 - to.x - to.width / 2 : 0;
    const dy = from ? from.y + from.height / 2 - to.y - to.height / 2 : -80;
    const rest = getComputedStyle(node).transform;
    this.motion(node, kind, [
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(-30deg) scale(.35)` },
      { opacity: 1, transform: rest },
    ], { duration: this.large ? 660 : 520, delay: kind === "draw" ? 0 : index * 95, easing: "cubic-bezier(.18,.8,.24,1)", fill: "backwards" });
    const face = node.firstElementChild as HTMLElement;
    if (!face.classList.contains("back")) this.flip(face, kind === "draw" ? 160 : index * 95 + 120);
  }

  private flip(card: HTMLElement, delay = 0) {
    this.motion(card, "reveal", [
      { transform: "perspective(700px) rotateY(90deg)", filter: "brightness(.65)" },
      { transform: "perspective(700px) rotateY(0deg)", filter: "brightness(1)" },
    ], { duration: 380, delay, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
  }
}

/** Pure presentation of public seats plus the authenticated owner's hand; no economy/card logic. */
export class PokTableView {
  readonly element = document.createElement("section");
  readonly timer = document.createElement("span");
  readonly deck = document.createElement("div");
  private seats = document.createElement("div");
  private total = document.createElement("div");
  private phase = document.createElement("p");
  private round = document.createElement("span");
  private views: { element: HTMLElement; title: HTMLElement; name: HTMLElement; info: HTMLElement; result: HTMLElement;
    avatar: HTMLElement; sit: HTMLButtonElement; hand: AnimatedCards; playerId?: string }[] = [];

  constructor(sit: (seat: number) => void) {
    this.element.className = "pok-arena";
    this.element.setAttribute("aria-label", "โต๊ะป๊อกเด้ง 8 ที่นั่ง");
    const felt = document.createElement("div");
    felt.className = "pok-felt";
    felt.setAttribute("aria-hidden", "true");
    this.seats.id = "pokSeats";
    const center = document.createElement("div");
    center.className = "pok-table-center";
    const brand = document.createElement("span");
    brand.className = "pok-table-brand";
    brand.textContent = "POK DENG";
    this.round.className = "pok-table-round";
    this.deck.className = "pok-deck";
    this.deck.setAttribute("aria-hidden", "true");
    this.deck.append(goldCoin());
    this.total.id = "pokTotalBet";
    this.phase.className = "pok-center-phase";
    this.timer.id = "pokTimer";
    this.timer.setAttribute("aria-label", "เวลาที่เหลือ");
    center.append(brand, this.round, this.total, this.deck, this.phase, this.timer);
    this.element.append(felt, center, this.seats);
    for (let i = 0; i < 8; i++) {
      const element = document.createElement("article");
      element.dataset.tableSeat = String(i);
      const avatar = document.createElement("div");
      avatar.className = "pok-avatar";
      avatar.setAttribute("aria-hidden", "true");
      // Small code-native pixel guest portrait, not a photo or an invented player balance.
      const face = document.createElement("span");
      face.className = "pok-avatar-face";
      avatar.append(face);
      const title = document.createElement("h3");
      const name = document.createElement("p");
      name.className = "pok-seat-name";
      const info = document.createElement("div");
      info.className = "pok-seat-stake";
      const cards = document.createElement("div");
      cards.className = "pok-cards";
      const result = document.createElement("p");
      result.className = "pok-result";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "นั่งที่นี่";
      button.dataset.seat = String(i);
      button.addEventListener("click", () => sit(i));
      element.append(avatar, title, name, info, button, cards, result);
      this.seats.append(element);
      this.views.push({ element, avatar, title, name, info, sit: button, result, hand: new AnimatedCards(cards, () => this.deck) });
    }
  }

  render(table: TableState | undefined, playerId: string, hand: PrivateHand | undefined, canSit: boolean) {
    const mine = table?.seats.find(seat => seat?.playerId === playerId);
    const owned = hand?.roundId === table?.roundId ? hand : undefined;
    this.element.dataset.phase = table?.phase ?? "betting";
    this.element.dataset.ownerSeat = String(mine?.seat ?? -1);
    const total = table?.seats.reduce((sum, seat) => sum + (seat?.bet ?? 0), 0) ?? 0;
    this.total.replaceChildren(document.createTextNode("เดิมพันรวม "), coinAmount(total, "suffix"));
    this.round.textContent = "ตาที่ " + (table?.roundNumber || 1) + " · " + (table?.seats.filter(Boolean).length ?? 0) + "/8 คน";
    this.phase.textContent = table ? PHASES[table.phase] : "เลือกเก้าอี้รอบโต๊ะ";
    for (let i = 0; i < 8; i++) {
      const seat = table?.seats[i];
      const view = this.views[i];
      const isMine = !!seat && seat.playerId === playerId;
      // Rotate seats so this guest always faces the table from the bottom. Dealer keeps its badge.
      const position = mine ? (i - mine.seat + 8) % 8 : (i + 4) % 8;
      view.element.dataset.position = String(position);
      view.element.className = "pok-seat" + (i === 0 ? " dealer" : "") + (isMine ? " mine" : "") + (!seat ? " empty" : "") + (seat?.cardCount ? " has-hand" : "");
      view.title.textContent = i === 0 ? "♛ เจ้ามือ" : "ลูกมือ " + i;
      view.sit.hidden = !!seat;
      view.sit.disabled = !canSit || !!mine;
      view.sit.setAttribute("aria-label", "นั่งที่นี่ · " + (i === 0 ? "เจ้ามือ" : "ลูกมือ " + i));
      view.avatar.hidden = !seat;
      view.name.hidden = view.info.hidden = view.result.hidden = !seat;
      view.name.textContent = seat ? seat.name + (isMine ? " (คุณ)" : "") : "";
      view.name.title = seat ? seat.name + (seat.leaving ? " · รอออกหลังจบตา" : !seat.connected ? " · หลุด" : "") : "";
      view.element.dataset.connection = seat?.leaving ? "leaving" : seat?.connected ? "online" : "offline";
      if (seat?.playerId !== view.playerId) {
        view.playerId = seat?.playerId;
        const hue = [...(seat?.playerId ?? "")].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
        view.avatar.style.setProperty("--avatar-color", `hsl(${hue} 46% 58%)`);
      }
      if (seat) {
        view.info.title = seat.dealer ? "เจ้ามือรับทุกเดิมพัน" : "เดิมพัน " + seat.bet + " ชิป";
        if (seat.dealer) view.info.textContent = "รับทุกเดิมพัน";
        else view.info.replaceChildren(coinAmount(seat.bet, "suffix"));
      } else view.info.replaceChildren();
      const visible = seat?.cards ?? (isMine ? owned?.cards : undefined);
      view.hand.render(`${table?.roomId}:${table?.roundId}:${seat?.playerId}`, visible, seat?.cardCount ?? 0);
      view.result.textContent = this.result(table, seat);
      const payout = table?.phase === "showdown" && seat ? seat.dealer ? -table.results.reduce((sum, item) => sum + item.delta, 0)
        : table.results.find(item => item.playerId === seat.playerId)?.delta : undefined;
      view.element.dataset.outcome = payout === undefined ? "" : payout > 0 ? "win" : payout < 0 ? "lose" : "tie";
    }
  }

  private result(table: TableState | undefined, seat: SeatView | null | undefined) {
    if (!seat) return "";
    const value = seat.value;
    let text = value ? (value.kind === "points" ? value.points + " แต้ม" : KINDS[value.kind]) + " ×" + value.multiplier
      : seat.leaving ? "รอออกหลังจบตา" : !seat.connected ? "หลุด · รอกลับมา" : seat.acted && table?.phase === "action" ? "เลือกแล้ว" : "";
    if (table?.phase === "showdown") {
      const delta = seat.dealer ? -table.results.reduce((sum, item) => sum + item.delta, 0) : table.results.find(item => item.playerId === seat.playerId)?.delta;
      if (delta !== undefined) text += " · " + (delta > 0 ? "+" : "") + delta + " ชิป";
    }
    return text;
  }
}
