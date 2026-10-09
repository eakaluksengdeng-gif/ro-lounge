import { Room, Client } from "colyseus";
import { Player, TownState } from "../schema/TownState";

// ค่าตั้งต้น ปรับได้ตามต้องการ
export const MAP_W = 1280;
export const MAP_H = 800;
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
      p.targetX = clamp(msg.x, 0, MAP_W);
      p.targetY = clamp(msg.y, 0, MAP_H);
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
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      });
    }, TICK_MS);
  }

  onJoin(client: Client, options: { name?: string }) {
    const p = new Player();
    p.name = cleanName(options?.name);
    p.x = p.targetX = MAP_W / 2 + (Math.random() - 0.5) * 120;
    p.y = p.targetY = MAP_H / 2 + (Math.random() - 0.5) * 120;
    p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
  }
}
