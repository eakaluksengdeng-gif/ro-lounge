import type { Room } from "colyseus.js";
import type { ApiError } from "../../../shared/pokdeng";
import type { FishingState, WeatherView, WeatherKind } from "../../../shared/nature";
import { FISH_SPECIES, FISHING_SPOTS, fishingLocationAt, fishingGaugePosition,
  FISHING_TARGET_START, FISHING_TARGET_END, FISHING_BITE_MS, FISHING_REWARD_RATES, FISHING_REWARD_WEIGHT } from "../../../shared/nature";
import type { TownScene } from "../scenes/TownScene";
import { gameSounds } from "../audio/GameSounds";
import { beachFishingLocation } from "../../../shared/regions";
import "./nature.css";
import { itemCanvas } from '../world/Cosmetics';
import { artImage } from '../reference/Assets';
import { renderCharacterCanvas } from '../art';
import { playerToLook } from '../character/appearance';
import { cosmeticCanvas } from '../world/Cosmetics';
import { coinAmount } from '../pokdeng/PixelCards';

const WEATHER = { sunny: "☀️ แดดออก", rain: "🌧️ ฝนตก", snow: "❄️ หิมะตก" };
export class NatureUI {
  private state?: FishingState;
  private offset = 0;
  private weather = document.createElement("span");
  private go = document.createElement("button");
  private fishCount = document.createElement("summary");
  private inventory = document.createElement("div");
  private panel = document.createElement("section");
  private title = document.createElement("strong");
  private message = document.createElement("p");
  private catchArt=document.createElement('div');
  private vignette=document.createElement('canvas');
  private previewKey='';
  private previewSprite?:HTMLCanvasElement;
  private previewAt=0;
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
  private soundState = "";
  private continuous=false;
  private castPending=false;

  constructor(private room: Room, private scene: TownScene) {
    const stop=()=>{if(this.continuous){this.continuous=false;this.room.send('fish:cancel',{});}};
    this.scene.interactions?.on('world:manual-move',stop);
    const toolbar = document.createElement("div");
    toolbar.id = "natureBar";
    this.weather.id = "townWeather";
    const go = this.go;
    go.type = "button";
    go.textContent = "🐟 ไปบ่อตกปลา";
    go.addEventListener("click", () => {
      if (this.scene.casinoOpen) return;
      const p = this.room.state?.players?.get(this.room.sessionId);
      if (!p) return;
      if(p.mapId&&p.mapId!=="town") {
        if(p.mapId==="beach")this.scene.navigateTo([{x:720,y:p.y},{x:720,y:602}]);
        else this.message.textContent="กลับเมืองหรือเดินไปชายหาดเพื่อตกปลา";
        return;
      }
      if (fishingLocationAt(p.x, p.y)) return;
      this.scene.navigateSafeTownTo([{ x: 500, y: 576 }, { x: 500, y: 648 }, { x: FISHING_SPOTS[0].x, y: FISHING_SPOTS[0].y }]);
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
    this.cancel.id='fishCancel';
    this.cancel.addEventListener("click", () => {
      this.continuous=false;
      this.castPending=false;
      gameSounds.play("cancel");
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
    this.catchArt.id='fishCatchArt';this.catchArt.hidden=true;
    const plaque=document.createElement('div');plaque.className='activity-plaque';plaque.textContent='FISHING';
    this.vignette.id='fishingScene';this.vignette.width=720;this.vignette.height=400;this.vignette.setAttribute('role','img');this.vignette.setAttribute('aria-label','ตัวละครคุณนั่งตกปลาที่ท่าไม้ริมน้ำ');
    this.panel.append(plaque,this.vignette,this.catchArt,this.title,this.message,this.gauge,this.bar,this.countdown,this.action,this.cancel,rates);
    document.body.append(this.panel);
    room.onMessage<FishingState>("fish:state", state => {
      const soundState = `${state.castId}:${state.phase}:${state.result?.reason ?? ""}`;
      if (this.soundState && soundState !== this.soundState) {
        if (state.phase === "waiting") gameSounds.play("cast");
        if (state.phase === "bite") gameSounds.play("bite");
        if (state.phase === "result") gameSounds.play(state.result?.reason === "caught" ? "catch" : "miss");
      }
      this.soundState = soundState;
      this.state = state;
      if(state.phase!=='idle')this.castPending=false;
      this.catchArt.hidden=state.result?.reason!=='caught';
      if(state.result?.fish&&state.result.reason==='caught')this.catchArt.replaceChildren(itemCanvas(state.result.fish.species),document.createTextNode('+ '),coinAmount(state.result.rewardChips??0,'suffix'));
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
      this.continuous=false;this.castPending=false;
      gameSounds.play("error");
      this.message.textContent = ({
        NOT_AT_POND: "เดินใกล้ริมบ่อ ตกได้ทุกด้านของบ่อ", ALREADY_FISHING: "กำลังตกปลาอยู่ รอหรือเก็บเบ็ดก่อน",
        IN_CASINO: "ออกจากโต๊ะไพ่ก่อนตกปลา", WRONG_CAST: "เบ็ดนี้จบแล้ว ลองเริ่มใหม่",
        ALREADY_REELED: "ดึงเบ็ดแล้ว รอเริ่มครั้งถัดไป", BITE_ENDED: "ปลาหลุดแล้ว ลองใหม่",
      } as Record<string, string>)[error.code] ?? error.message;
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || this.scene.casinoOpen || this.scene.worldOpen) return;
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
      if(performance.now()-this.previewAt>33){this.renderVignette();this.previewAt=performance.now();}
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    room.onLeave(() => {
      this.scene.interactions?.off('world:manual-move',stop);
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
  private renderVignette(){
    if(this.panel.hidden)return;const p=this.room.state?.players?.get(this.room.sessionId);if(!p)return;
    const look=playerToLook(p),cosmetic=p.cosmetic&&p.cosmetic!=='none'?p.cosmetic:'straw-hat',key=JSON.stringify([look,cosmetic]);
    if(key!==this.previewKey){this.previewKey=key;this.previewSprite=renderCharacterCanvas(look,'side',0,'fishing');this.previewSprite.getContext('2d')!.drawImage(cosmeticCanvas(cosmetic),0,0);}
    const c=this.vignette.getContext('2d')!;c.imageSmoothingEnabled=false;c.drawImage(artImage('activity-cove'),0,0,720,540);
    c.save();c.translate(506,0);c.scale(-1,1);c.drawImage(this.previewSprite!,0,196,96,128);c.restore();
    const t=matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now();
    const y=343+Math.sin(t/(this.state?.phase==='bite'?90:700))*(this.state?.phase==='bite'?5:2);
    if(this.state?.phase==='waiting'||this.state?.phase==='bite'){
      c.strokeStyle='#795335';c.lineWidth=5;c.beginPath();c.moveTo(437,283);c.lineTo(335,234);c.stroke();
      c.strokeStyle='#f7ecc8';c.lineWidth=2;c.beginPath();c.moveTo(335,234);c.lineTo(298,y);c.stroke();
      c.strokeStyle='#d5ffff';c.lineWidth=3;c.beginPath();c.ellipse(298,y+4,18+Math.sin(t/300)*4,5,0,0,Math.PI*2);c.stroke();
      c.fillStyle='#fff5df';c.fillRect(294,y-7,8,8);c.fillStyle='#e86675';c.fillRect(294,y+1,8,7);
    }
  }

  private interact() {
    if (this.closed || this.scene.casinoOpen || this.scene.worldOpen) return;
    if (this.state?.phase === "waiting" || this.state?.phase === "bite") {
      gameSounds.play("reel");
      this.room.send("fish:reel", { castId: this.state.castId });
    } else if (this.state?.phase !== "result" && this.near) {
      if(this.castPending)return;
      this.continuous=true;this.castPending=true;
      this.scene.stopNavigation();
      this.room.send("fish:cast", {});
    }
  }
  private render() {
    if (this.closed) return;
    const p = this.room.state?.players?.get(this.room.sessionId);
    this.go.disabled=!!p?.mapId&&p.mapId!=="town"&&p.mapId!=="beach";
    this.near = !!p && !!((p.mapId??"town")==="town"?fishingLocationAt(p.x,p.y):p.mapId==="beach"?beachFishingLocation(p.x,p.y):null);
    const phase = this.state?.phase ?? "idle";
    if(this.continuous&&(!this.near||this.scene.casinoOpen||this.scene.worldOpen)){
      this.continuous=false;this.room.send("fish:cancel",{});
    }
    if(this.continuous&&phase==="idle"&&!this.castPending)this.interact();
    this.panel.hidden = this.scene.casinoOpen || (!this.near && phase === "idle");
    this.panel.dataset.phase = phase;
    this.panel.dataset.near = String(this.near);
    this.panel.dataset.sitting=String(phase==='waiting'||phase==='bite');
    document.getElementById("hud")?.classList.toggle("fishing-active", !this.panel.hidden);
    const weather = (this.room.state?.weather ?? "sunny") as WeatherKind;
    gameSounds.setWeather(weather);
    const remaining = Math.max(0, Math.ceil(((this.room.state?.weatherNextChangeAt ?? Date.now()) - Date.now() - this.offset) / 1000));
    const night=p?.mapId==="market"||Math.floor(Date.now()/300000)%4>=2;
    this.weather.textContent = (weather==="sunny"&&night?"🌙 ฟ้าโปร่ง":WEATHER[weather]) + " · " + Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
    this.weather.dataset.kind = weather;
    this.weather.dataset.wildlife = String(this.room.state?.wildlife?.size ?? 0);
    this.title.textContent = phase === "bite" ? "❗ ปลาติดเบ็ด! เล็งแถบแดง" : p?.mapId==="beach"?"🎣 ตกปลาทะเล · SPACE / แตะ":"🎣 ตกปลาได้รอบริมบ่อ";
    if (phase === "waiting") this.message.textContent = "รอทุ่นกระตุก… อย่าเพิ่งดึงเบ็ด";
    if (phase === "bite") this.message.textContent = "ตัวชี้วิ่งซ้าย–ขวา กด Space หรือดึงเบ็ดเมื่อตัวชี้ตรงแถบแดง!";
    this.action.textContent = phase === "bite" ? "SPACE / TAP" : phase === "waiting" ? "รอปลากินเหยื่อ…" : phase === "result" ? "รอสักครู่…" : "SPACE / TAP · ตกปลา";
    this.action.setAttribute('aria-label',phase==='bite'?'ดึงเบ็ด Space หรือแตะ':'เริ่มตกปลา Space หรือแตะ');
    this.action.disabled = phase === "waiting" || phase === "result" || this.scene.casinoOpen;
    this.cancel.textContent="หยุดตกต่อเนื่อง · เก็บเบ็ด";
    this.cancel.hidden = !this.continuous && phase !== "waiting" && phase !== "bite";
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
        line.prepend(itemCanvas(fish.id));
        this.inventory.append(line);
      }
    }
  }
}
