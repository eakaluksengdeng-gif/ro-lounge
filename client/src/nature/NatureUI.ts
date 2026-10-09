import type { Room } from "colyseus.js";
import type { ApiError } from "../../../shared/pokdeng";
import type { FishingState, WeatherView, WeatherKind } from "../../../shared/nature";
import { FISH_SPECIES, FISHING_SPOTS, fishingLocationAt, fishingGaugePosition,
  FISHING_TARGET_START, FISHING_TARGET_END, FISHING_BITE_MS, FISHING_REWARD_RATES, FISHING_REWARD_WEIGHT } from "../../../shared/nature";
import type { TownScene } from "../scenes/TownScene";
import "./nature.css";

const WEATHER = { sunny: "☀️ แดดออก", rain: "🌧️ ฝนตก", snow: "❄️ หิมะตก" };
export class NatureUI {
  private state?: FishingState;
  private offset = 0;
  private weather = document.createElement("span");
  private fishCount = document.createElement("summary");
  private inventory = document.createElement("div");
  private panel = document.createElement("section");
  private title = document.createElement("strong");
  private message = document.createElement("p");
  private action = document.createElement("button");
  private cancel = document.createElement("button");
  private bar = document.createElement("div");
  private fill = document.createElement("span");
  private gauge = document.createElement("div");
  private needle = document.createElement("span");
  private countdown = document.createElement("span");
  private near = false;
  private renderedInventory = "";
  private closed = false;
  private clockReady = false;
  private clockNonce = 0;
  private clockRequests = new Map<number, number>();
  private minRtt = Infinity;

  constructor(private room: Room, private scene: TownScene) {
    const toolbar = document.createElement("div");
    toolbar.id = "natureBar";
    this.weather.id = "townWeather";
    const go = document.createElement("button");
    go.type = "button";
    go.textContent = "🐟 ไปบ่อตกปลา";
    go.addEventListener("click", () => {
      if (this.scene.casinoOpen) return;
      const p = this.room.state?.players?.get(this.room.sessionId);
      if (!p) return;
      if (fishingLocationAt(p.x, p.y)) return;
      this.scene.navigateTo([{ x: p.x, y: 576 }, { x: 500, y: 576 }, { x: 500, y: 648 }, { x: FISHING_SPOTS[0].x, y: FISHING_SPOTS[0].y }]);
    });
    const bag = document.createElement("details");
    bag.id = "fishBag";
    this.fishCount.textContent = "🐟 ปลา 0";
    bag.append(this.fishCount, this.inventory);
    toolbar.append(this.weather, go, bag);
    document.body.append(toolbar);
    this.panel.id = "fishingPanel";
    this.panel.hidden = true;
    this.panel.setAttribute("aria-label", "ตกปลา");
    this.message.setAttribute("role", "status");
    this.title.textContent = "🎣 ตกปลาริมบ่อ";
    this.message.textContent = "ตกได้รอบริมบ่อ · รอปลาแล้วกด Space ให้ตัวชี้ตรงแถบแดง · ชิป 1–20";
    this.action.id = "fishAction";
    this.action.type = this.cancel.type = "button";
    this.action.addEventListener("click", () => this.interact());
    this.cancel.textContent = "เก็บเบ็ด";
    this.cancel.addEventListener("click", () => {
      this.message.textContent = "เก็บเบ็ดแล้ว กดเริ่มตกปลาเพื่อลองใหม่";
      this.room.send("fish:cancel", {});
    });
    this.bar.id = "fishReaction";
    this.bar.append(this.fill);
    this.gauge.id = "fishSkillGauge";
    this.gauge.hidden = true;
    this.gauge.setAttribute("role", "img");
    this.gauge.setAttribute("aria-label", "เกจตกปลา: กดเมื่อตัวชี้ตรงแถบแดงกลางเกจ");
    const target = document.createElement("span");
    target.id = "fishTarget";
    target.style.left = FISHING_TARGET_START * 100 + "%";
    target.style.width = (FISHING_TARGET_END - FISHING_TARGET_START) * 100 + "%";
    this.needle.id = "fishNeedle";
    this.gauge.append(target, this.needle);
    this.countdown.id = "fishCountdown";
    const rates = document.createElement("details");
    rates.id = "fishRates";
    const summary = document.createElement("summary");
    summary.textContent = "อัตรารางวัล 1–20 ชิป · ยิ่งเยอะยิ่งหายาก";
    const list = document.createElement("div");
    for (const entry of FISHING_REWARD_RATES) {
      const row = document.createElement("span");
      row.textContent = entry.chips + " ชิป · " + (entry.weight / FISHING_REWARD_WEIGHT * 100).toFixed(2) + "%";
      list.append(row);
    }
    rates.append(summary, list);
    this.panel.append(this.title, this.message, this.gauge, this.bar, this.countdown, this.action, this.cancel, rates);
    document.body.append(this.panel);
    room.onMessage<FishingState>("fish:state", state => {
      this.state = state;
      if (!this.clockReady) this.offset = state.serverTime - Date.now();
      if (state.phase !== "idle") this.scene.stopNavigation();
      if (state.result?.reason === "caught") this.message.textContent = "ได้ " + state.result.fish!.name + " " + state.result.fish!.lengthCm + " ซม.! 🐟 +" + state.result.rewardChips + " ชิป";
      if (state.result?.reason === "early") this.message.textContent = "ดึงเบ็ดเร็วไป ปลายังไม่กินเหยื่อ";
      if (state.result?.reason === "late") this.message.textContent = "ช้าไปนิด ปลาหลุดแล้ว ลองใหม่ได้";
      if (state.result?.reason === "miss") this.message.textContent = "กดไม่ตรงแถบแดง ปลาหลุดแล้ว ลองใหม่ได้";
      this.render();
    });
    room.onMessage<WeatherView>("nature:weather", state => {
      if (!this.clockReady) this.offset = state.serverTime - Date.now();
      toolbar.dataset.weather = state.kind;
    });
    room.onMessage<{ nonce: number; serverTime: number }>("fish:clock", state => {
      const sentAt = this.clockRequests.get(state.nonce);
      if (sentAt === undefined || !Number.isFinite(state.serverTime)) return;
      this.clockRequests.delete(state.nonce);
      const rtt = performance.now() - sentAt;
      // Midpoint of a server reply removes outbound-delay bias; trust only timely samples.
      if (rtt < 2000 && rtt <= this.minRtt + 50) {
        this.minRtt = Math.min(this.minRtt, rtt);
        this.offset = state.serverTime - (Date.now() - rtt / 2);
        this.clockReady = true;
      }
    });
    room.onMessage<ApiError>("api:error", error => {
      if (!error.event.startsWith("fish:")) return;
      this.message.textContent = ({
        NOT_AT_POND: "เดินใกล้ริมบ่อ ตกได้ทุกด้านของบ่อ", ALREADY_FISHING: "กำลังตกปลาอยู่ รอหรือเก็บเบ็ดก่อน",
        IN_CASINO: "ออกจากโต๊ะไพ่ก่อนตกปลา", WRONG_CAST: "เบ็ดนี้จบแล้ว ลองเริ่มใหม่",
        ALREADY_REELED: "ดึงเบ็ดแล้ว รอเริ่มครั้งถัดไป", BITE_ENDED: "ปลาหลุดแล้ว ลองใหม่",
      } as Record<string, string>)[error.code] ?? error.message;
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || this.scene.casinoOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,summary,[contenteditable]")) return;
      if (target?.closest("button") && !target.closest("#fishAction,#natureBar")) return;
      if (!this.near && this.state?.phase !== "waiting" && this.state?.phase !== "bite") return;
      event.preventDefault();
      this.interact();
    };
    window.addEventListener("keydown", onKey);
    const interval = window.setInterval(() => this.render(), 150);
    const clockInterval = window.setInterval(() => this.syncClock(), 5000);
    let frame = 0;
    const animate = () => {
      if (this.closed) return;
      this.renderGauge();
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    room.onLeave(() => {
      this.closed = true;
      window.clearInterval(interval);
      window.clearInterval(clockInterval);
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      toolbar.remove(); this.panel.remove();
      document.getElementById("hud")?.classList.remove("fishing-active");
    });
    this.syncClock();
    room.send("fish:sync", {});
    room.send("nature:sync", {});
  }

  private syncClock() {
    if (this.closed) return;
    this.clockRequests.clear();
    const nonce = ++this.clockNonce;
    this.clockRequests.set(nonce, performance.now());
    this.room.send("fish:clock", { nonce });
  }
  private renderGauge() {
    if (this.state?.phase !== "bite" || this.state.biteStartedAt === null) return;
    const position = fishingGaugePosition(this.state.biteStartedAt, Date.now() + this.offset);
    this.needle.style.left = position * 100 + "%";
    this.gauge.dataset.position = String(position);
    this.gauge.dataset.inTarget = String(position >= FISHING_TARGET_START && position <= FISHING_TARGET_END);
    this.countdown.textContent = "เหลือ " + Math.max(0, ((this.state.deadline ?? 0) - Date.now() - this.offset) / 1000).toFixed(1) + " วิ · กดได้ครั้งเดียว";
  }

  private interact() {
    if (this.closed || this.scene.casinoOpen) return;
    if (this.state?.phase === "waiting" || this.state?.phase === "bite") {
      this.room.send("fish:reel", { castId: this.state.castId });
    } else if (this.state?.phase !== "result" && this.near) {
      this.scene.stopNavigation();
      this.room.send("fish:cast", {});
    }
  }
  private render() {
    if (this.closed) return;
    const p = this.room.state?.players?.get(this.room.sessionId);
    this.near = !!p && !!fishingLocationAt(p.x, p.y);
    const phase = this.state?.phase ?? "idle";
    this.panel.hidden = this.scene.casinoOpen || (!this.near && phase === "idle");
    this.panel.dataset.phase = phase;
    this.panel.dataset.near = String(this.near);
    document.getElementById("hud")?.classList.toggle("fishing-active", !this.panel.hidden);
    const weather = (this.room.state?.weather ?? "sunny") as WeatherKind;
    const remaining = Math.max(0, Math.ceil(((this.room.state?.weatherNextChangeAt ?? Date.now()) - Date.now() - this.offset) / 1000));
    this.weather.textContent = WEATHER[weather] + " · " + Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
    this.weather.dataset.kind = weather;
    this.weather.dataset.wildlife = String(this.room.state?.wildlife?.size ?? 0);
    this.title.textContent = phase === "bite" ? "❗ ปลาติดเบ็ด! เล็งแถบแดง" : "🎣 ตกปลาได้รอบริมบ่อ";
    if (phase === "waiting") this.message.textContent = "รอทุ่นกระตุก… อย่าเพิ่งดึงเบ็ด";
    if (phase === "bite") this.message.textContent = "ตัวชี้วิ่งซ้าย–ขวา กด Space หรือดึงเบ็ดเมื่อตัวชี้ตรงแถบแดง!";
    this.action.textContent = phase === "bite" ? "SPACE — ดึงเบ็ด!" : phase === "waiting" ? "กำลังรอปลา…" : phase === "result" ? "รอสักครู่…" : "เริ่มตกปลา (Space)";
    this.action.disabled = phase === "waiting" || phase === "result" || this.scene.casinoOpen;
    this.cancel.hidden = phase !== "waiting" && phase !== "bite";
    this.bar.hidden = phase !== "bite";
    this.gauge.hidden = this.countdown.hidden = phase !== "bite";
    const ratio = phase === "bite" ? Math.max(0, Math.min(1, ((this.state?.deadline ?? 0) - Date.now() - this.offset) / FISHING_BITE_MS)) : 0;
    this.fill.style.width = ratio * 100 + "%";
    const signature = JSON.stringify(this.state?.inventory ?? {});
    this.fishCount.textContent = "🐟 ปลา " + (this.state?.total ?? 0);
    if (signature !== this.renderedInventory) {
      this.renderedInventory = signature;
      this.inventory.replaceChildren();
      for (const fish of FISH_SPECIES) {
        const line = document.createElement("p");
        line.textContent = fish.name + " × " + (this.state?.inventory[fish.id] ?? 0);
        this.inventory.append(line);
      }
    }
  }
}
