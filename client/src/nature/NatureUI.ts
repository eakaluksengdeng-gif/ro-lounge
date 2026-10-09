import type { Room } from "colyseus.js";
import type { ApiError } from "../../../shared/pokdeng";
import type { FishingState, WeatherView, WeatherKind } from "../../../shared/nature";
import { FISH_SPECIES, FISHING_SPOTS, fishingSpotAt } from "../../../shared/nature";
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
  private near = false;
  private renderedInventory = "";
  private closed = false;

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
      if (fishingSpotAt(p.x, p.y) >= 0) return;
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
    this.message.textContent = "รอเหยื่อกระตุก แล้วกด Spacebar ให้ทัน · ได้ปลา +10 ชิป";
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
    this.panel.append(this.title, this.message, this.bar, this.action, this.cancel);
    document.body.append(this.panel);
    room.onMessage<FishingState>("fish:state", state => {
      this.state = state;
      this.offset = state.serverTime - Date.now();
      if (state.phase !== "idle") this.scene.stopNavigation();
      if (state.result?.reason === "caught") this.message.textContent = "ได้ " + state.result.fish!.name + " " + state.result.fish!.lengthCm + " ซม.! 🐟 +" + state.result.rewardChips + " ชิป";
      if (state.result?.reason === "early") this.message.textContent = "ดึงเบ็ดเร็วไป ปลายังไม่กินเหยื่อ";
      if (state.result?.reason === "late") this.message.textContent = "ช้าไปนิด ปลาหลุดแล้ว ลองใหม่ได้";
      this.render();
    });
    room.onMessage<WeatherView>("nature:weather", state => {
      this.offset = state.serverTime - Date.now();
      toolbar.dataset.weather = state.kind;
    });
    room.onMessage<ApiError>("api:error", error => {
      if (!error.event.startsWith("fish:")) return;
      this.message.textContent = ({
        NOT_AT_POND: "เดินใกล้ป้ายตกปลาริมบ่อก่อน", ALREADY_FISHING: "กำลังตกปลาอยู่ รอหรือเก็บเบ็ดก่อน",
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
    room.onLeave(() => {
      this.closed = true;
      window.clearInterval(interval);
      window.removeEventListener("keydown", onKey);
      toolbar.remove(); this.panel.remove();
      document.getElementById("hud")?.classList.remove("fishing-active");
    });
    room.send("fish:sync", {});
    room.send("nature:sync", {});
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
    this.near = !!p && fishingSpotAt(p.x, p.y) >= 0;
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
    this.title.textContent = phase === "bite" ? "❗ ปลากินเหยื่อ! กด SPACEBAR!" : "🎣 ตกปลาริมบ่อ";
    if (phase === "waiting") this.message.textContent = "รอทุ่นกระตุก… อย่าเพิ่งดึงเบ็ด";
    if (phase === "bite") this.message.textContent = "กด Spacebar หรือปุ่มดึงเบ็ดให้ทันก่อนแถบเวลาหมด!";
    this.action.textContent = phase === "bite" ? "SPACE — ดึงเบ็ด!" : phase === "waiting" ? "กำลังรอปลา…" : phase === "result" ? "รอสักครู่…" : "เริ่มตกปลา (Space)";
    this.action.disabled = phase === "waiting" || phase === "result" || this.scene.casinoOpen;
    this.cancel.hidden = phase !== "waiting" && phase !== "bite";
    this.bar.hidden = phase !== "bite";
    const ratio = phase === "bite" ? Math.max(0, Math.min(1, ((this.state?.deadline ?? 0) - Date.now() - this.offset) / 3000)) : 0;
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
