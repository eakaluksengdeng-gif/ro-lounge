import { Room, Client } from "colyseus";
import { Player, TownState } from "../schema/TownState";
import { clampToMap, isBlocked, spawnPoint } from "../world";

// ค่าตั้งต้น ปรับได้ตามต้องการ
const TICK_MS = 50;
const SPEED = 180; // พิกเซลต่อวินาที
const CHAT_MAX_LEN = 120;
const CHAT_COOLDOWN_MS = 700;
const EMOTES = new Set(["happy", "sad", "love", "wave", "angry", "sleepy"]);
const COLORS = [0xf28b82, 0xfbbc04, 0xa7d676, 0x78d9ec, 0xaecbfa, 0xd7aefb, 0xfdcfe8];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function cleanName(raw: unknown): string {
  const s = String(raw ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 16);
  return s || "Guest" + Math.floor(Math.random() * 1000);
}

function optionIndex(raw: unknown, count: number, fallback = 0): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < count ? n : fallback;
}

interface JoinOptions {
  name?: string;
  appearance?: {
    color?: number;
    hair?: number;
    skin?: number;
    pants?: number;
    style?: number;
  };
}

export class TownRoom extends Room<TownState> {
  maxClients = 50;
  private lastChat = new Map<string, number>();

  onCreate() {
    this.setState(new TownState());

    // client -> server: เจตนาจะเดินไปที่จุดนี้
    this.onMessage("move", (client, msg: { x?: number; y?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg?.x !== "number" || typeof msg?.y !== "number") return;
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
      const t = clampToMap(msg.x, msg.y);
      p.targetX = t.x;
      p.targetY = t.y;
    });

    this.onMessage("chat", (client, msg: { text?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const text = String(msg?.text ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, CHAT_MAX_LEN);
      if (!text) return;
      const now = Date.now();
      if (now - (this.lastChat.get(client.sessionId) ?? 0) < CHAT_COOLDOWN_MS) return;
      this.lastChat.set(client.sessionId, now);
      this.broadcast("chat", { id: client.sessionId, name: p.name, text });
    });

    this.onMessage("emote", (client, msg: { name?: string }) => {
      if (!this.state.players.has(client.sessionId)) return;
      const name = String(msg?.name ?? "");
      if (!EMOTES.has(name)) return;
      this.broadcast("emote", { id: client.sessionId, name });
    });

    // เซิร์ฟเวอร์เป็นคนขยับตัวละคร ด้วยความเร็วคงที่ กันโกง
    this.setSimulationInterval((dtMs) => {
      const dt = dtMs / 1000;
      this.state.players.forEach((p) => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;
        const step = Math.min(dist, SPEED * dt);
        const nx = p.x + (dx / dist) * step;
        const ny = p.y + (dy / dist) * step;
        // เดินชนสระน้ำ/น้ำพุ/ต้นไม้ไม่ได้ ลองไถลไปตามแกนใดแกนหนึ่งก่อน ถ้าไม่ได้ก็หยุด
        if (!isBlocked(nx, ny)) {
          p.x = nx;
          p.y = ny;
        } else if (!isBlocked(nx, p.y) && Math.abs(dx) > 1) {
          p.x = nx;
        } else if (!isBlocked(p.x, ny) && Math.abs(dy) > 1) {
          p.y = ny;
        } else {
          p.targetX = p.x;
          p.targetY = p.y;
        }
        if (Math.hypot(p.targetX - p.x, p.targetY - p.y) >= dist - 0.01) {
          // ไม่คืบหน้าเข้าหาเป้าหมายแล้ว (ติดสิ่งกีดขวาง) ให้หยุด
          p.targetX = p.x;
          p.targetY = p.y;
        }
      });
    }, TICK_MS);
  }

  onJoin(client: Client, options: JoinOptions) {
    const p = new Player();
    p.name = cleanName(options?.name);
    const appearance = options?.appearance;
    p.color = COLORS[optionIndex(appearance?.color, COLORS.length, Math.floor(Math.random() * COLORS.length))];
    p.hair = optionIndex(appearance?.hair, 6);
    p.skin = optionIndex(appearance?.skin, 3);
    p.pants = optionIndex(appearance?.pants, 3);
    p.style = optionIndex(appearance?.style, 3);
    const sp = spawnPoint();
    p.x = p.targetX = sp.x;
    p.y = p.targetY = sp.y;
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
  }
}
