import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { ChatMsg, EmoteMsg, PlayerState } from "../net";

export const MAP_W = 1280;
export const MAP_H = 800;
const TILE = 40;
const BUBBLE_MS = 5000;
const EMOTE_MS = 1800;
const EMOTE_ICONS: Record<string, string> = {
  happy: "😄", sad: "😢", love: "❤️", wave: "👋", angry: "💢", sleepy: "💤",
};

interface Avatar {
  container: Phaser.GameObjects.Container;
  bubble: Phaser.GameObjects.Text;
  emote: Phaser.GameObjects.Text;
  bubbleTimer?: Phaser.Time.TimerEvent;
  emoteTimer?: Phaser.Time.TimerEvent;
}

export class TownScene extends Phaser.Scene {
  private avatars = new Map<string, Avatar>();

  constructor(private room: Room<any>, private onChat: (m: ChatMsg) => void) {
    super("town");
  }

  create() {
    this.drawMap();
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);

    // คลิกพื้นเพื่อเดิน (แปลงพิกัดหน้าจอเป็นพิกัดโลก)
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.room.send("move", { x: Math.round(p.worldX), y: Math.round(p.worldY) });
    });

    this.room.onMessage("chat", (m: ChatMsg) => {
      this.showBubble(m.id, m.text);
      this.onChat(m);
    });
    this.room.onMessage("emote", (m: EmoteMsg) => this.showEmote(m.id, m.name));
  }

  update(_t: number, dtMs: number) {
    const players = this.room.state?.players;
    if (!players) return;

    // สร้างตัวละครที่เพิ่งเข้ามา
    const seen = new Set<string>();
    players.forEach((p: PlayerState, id: string) => {
      seen.add(id);
      let av = this.avatars.get(id);
      if (!av) {
        av = this.createAvatar(p, id === this.room.sessionId);
        this.avatars.set(id, av);
        av.container.setPosition(p.x, p.y);
        if (id === this.room.sessionId) this.cameras.main.startFollow(av.container, true, 0.1, 0.1);
      }
      // เลื่อนเข้าหาตำแหน่งจากเซิร์ฟเวอร์ให้ดูนุ่ม
      const k = 1 - Math.pow(0.001, dtMs / 1000);
      av.container.x += (p.x - av.container.x) * k;
      av.container.y += (p.y - av.container.y) * k;
      av.container.setDepth(av.container.y);
    });

    // ลบตัวละครที่ออกไปแล้ว
    for (const [id, av] of this.avatars) {
      if (!seen.has(id)) {
        av.container.destroy();
        this.avatars.delete(id);
      }
    }
  }

  private drawMap() {
    const g = this.add.graphics().setDepth(-1000);
    for (let ty = 0; ty < MAP_H / TILE; ty++) {
      for (let tx = 0; tx < MAP_W / TILE; tx++) {
        const alt = (tx + ty) % 2 === 0;
        g.fillStyle(alt ? 0x6fb36a : 0x66a862, 1);
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    // ลานหินตรงกลาง
    g.fillStyle(0xd8c9a3, 1);
    g.fillRoundedRect(MAP_W / 2 - 200, MAP_H / 2 - 120, 400, 240, 24);
    g.lineStyle(3, 0xb9a77c, 1);
    g.strokeRoundedRect(MAP_W / 2 - 200, MAP_H / 2 - 120, 400, 240, 24);
    // น้ำพุ
    g.fillStyle(0x7fc4e8, 1);
    g.fillCircle(MAP_W / 2, MAP_H / 2, 46);
    g.lineStyle(6, 0xeeeeee, 1);
    g.strokeCircle(MAP_W / 2, MAP_H / 2, 46);
    // ต้นไม้ตกแต่งรอบขอบ
    const trees: [number, number][] = [[120, 120], [300, 90], [980, 110], [1160, 160], [160, 660], [420, 700], [900, 680], [1120, 620]];
    for (const [x, y] of trees) {
      g.fillStyle(0x7a5a3a, 1);
      g.fillRect(x - 6, y, 12, 28);
      g.fillStyle(0x3f8f4a, 1);
      g.fillCircle(x, y - 6, 30);
    }
    this.add.text(MAP_W / 2, 40, "Town Square", { fontSize: "20px", color: "#ffffff" })
      .setOrigin(0.5).setAlpha(0.7).setDepth(-999);
  }

  private createAvatar(p: PlayerState, isMe: boolean): Avatar {
    const body = this.add.graphics();
    // เงา
    body.fillStyle(0x000000, 0.2);
    body.fillEllipse(0, 2, 30, 10);
    // ตัว
    body.fillStyle(p.color, 1);
    body.fillRoundedRect(-11, -26, 22, 26, 6);
    // หัว (chibi หัวโต)
    body.fillStyle(0xffe2c4, 1);
    body.fillCircle(0, -38, 15);
    body.fillStyle(0x2b2b2b, 1);
    body.fillCircle(-5, -38, 2);
    body.fillCircle(5, -38, 2);
    if (isMe) {
      body.lineStyle(2, 0xffffff, 0.9);
      body.strokeEllipse(0, 2, 34, 12);
    }

    const name = this.add.text(0, 12, p.name, {
      fontSize: "13px", color: "#ffffff", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5, 0);

    const bubble = this.add.text(0, -66, "", {
      fontSize: "14px", color: "#222222", backgroundColor: "#ffffff",
      padding: { x: 8, y: 5 }, wordWrap: { width: 190 }, align: "center",
    }).setOrigin(0.5, 1).setVisible(false);

    const emote = this.add.text(0, -62, "", { fontSize: "30px" })
      .setOrigin(0.5, 1).setVisible(false);

    const container = this.add.container(0, 0, [body, name, bubble, emote]);
    return { container, bubble, emote };
  }

  private showBubble(id: string, text: string) {
    const av = this.avatars.get(id);
    if (!av) return;
    av.emote.setVisible(false);
    av.bubble.setText(text).setVisible(true);
    av.bubbleTimer?.remove();
    av.bubbleTimer = this.time.delayedCall(BUBBLE_MS, () => av.bubble.setVisible(false));
  }

  private showEmote(id: string, name: string) {
    const av = this.avatars.get(id);
    const icon = EMOTE_ICONS[name];
    if (!av || !icon) return;
    av.bubble.setVisible(false);
    av.emote.setText(icon).setVisible(true).setScale(0.3);
    this.tweens.add({ targets: av.emote, scale: 1, duration: 220, ease: "Back.Out" });
    av.emoteTimer?.remove();
    av.emoteTimer = this.time.delayedCall(EMOTE_MS, () => av.emote.setVisible(false));
  }
}
