import Phaser from "phaser";
import { CASINO_BUILDING, CASINO_DOOR } from "../../../shared/casinoWorld";
import { HAIR_COLORS as HAIR, SKIN_COLORS as SKIN, PANTS_COLORS as PANTS } from "../character/appearance";
import type { Room } from "colyseus.js";
import type { ChatMsg, EmoteMsg, PlayerState } from "../net";
import {
  BENCHES, FOUNTAIN, LAMPS, MAP_H, MAP_W, PATH_COLS, PATH_ROWS, PLAZA, POND, PX, TILE, TILES_X, TILES_Y,
  TILE_PX, TREES, treeFeet,
} from "../world";
import {
  CHAR_H, CHAR_ORIGIN_Y, buildWorldTextures, ensureCharacter, hashString, mulberry32,
  type Dir, type Look,
} from "../art";

const FONT = '"Pixelify Sans", "Noto Sans Thai", system-ui, sans-serif';
const BUBBLE_MS = 5000;
const EMOTE_MS = 1800;
const EMOTE_ICONS: Record<string, string> = {
  happy: "😄", sad: "😢", love: "❤️", wave: "👋", angry: "💢", sleepy: "💤",
};


const HEAD_Y = -(CHAR_H + 2) * PX - 4; // ตำแหน่งเหนือหัวสำหรับ bubble / emote
const WALK_STEP_PX = 22; // ระยะเดินต่อ 1 ท่า
const WALK_SEQ = [1, 0, 2, 0];

interface Avatar {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  look: Look;
  bubble: Phaser.GameObjects.Container;
  bubbleGfx: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  emote: Phaser.GameObjects.Text;
  bubbleTimer?: Phaser.Time.TimerEvent;
  emoteTimer?: Phaser.Time.TimerEvent;
  dir: Dir;
  flip: boolean;
  walk: number;
  texKey: string;
}

export class TownScene extends Phaser.Scene {
  casinoOpen = false;
  onManualMove?: () => void;
  private avatars = new Map<string, Avatar>();
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private fountain?: Phaser.GameObjects.Image;

  constructor(private room: Room<any>, private onChat: (m: ChatMsg) => void) {
    super("town");
  }

  create() {
    buildWorldTextures(this);
    this.cameras.main.setBackgroundColor("#1b2230");
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setRoundPixels(true);
    this.buildMap();

    // ภาพเคลื่อนไหวของน้ำและน้ำพุ
    let tick = 0;
    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        tick++;
        for (const w of this.waterTiles) w.setTexture(`water${tick % 2}`);
        this.fountain?.setTexture(`fountain${tick % 2}`);
      },
    });

    // คลิกพื้นเพื่อเดิน
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // Phaser can receive document-level pointer events over HTML overlays.
      if (!(p.event?.target instanceof HTMLCanvasElement)) return;
      if (this.casinoOpen) return;
      this.onManualMove?.();
      const x = Math.round(p.worldX);
      const y = Math.round(p.worldY);
      this.room.send("move", { x, y });
      const ring = this.add.circle(x, y, 7, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.9).setDepth(MAP_H + 10);
      this.tweens.add({
        targets: ring, scale: 2.2, alpha: 0, duration: 380, onComplete: () => ring.destroy(),
      });
    });

    this.room.onMessage("chat", (m: ChatMsg) => {
      this.showBubble(m.id, m.text);
      this.onChat(m);
    });
    this.room.onMessage("emote", (m: EmoteMsg) => this.showEmote(m.id, m.name));
  }

  /* ---------------- แมพ ---------------- */

  private buildMap() {
    const rnd = mulberry32(7);
    const rt = this.add.renderTexture(0, 0, TILES_X * TILE, TILES_Y * TILE)
      .setOrigin(0).setScale(PX).setDepth(-1000);

    const pondDist = (tx: number, ty: number) =>
      ((tx + 0.5 - POND.cx) / POND.rx) ** 2 + ((ty + 0.5 - POND.cy) / POND.ry) ** 2;
    const inPlaza = (tx: number, ty: number) =>
      tx >= PLAZA.x0 && tx <= PLAZA.x1 && ty >= PLAZA.y0 && ty <= PLAZA.y1;
    const isPath = (tx: number, ty: number) => PATH_ROWS.includes(ty) || PATH_COLS.includes(tx);

    const grassTiles: [number, number][] = [];
    for (let ty = 0; ty < TILES_Y; ty++) {
      for (let tx = 0; tx < TILES_X; tx++) {
        let key: string;
        if (inPlaza(tx, ty)) key = `stone${(tx + ty) % 2}`;
        else if (isPath(tx, ty)) key = `path${Math.floor(rnd() * 3)}`;
        else if (pondDist(tx, ty) <= 1.45) key = "sand0";
        else {
          const r = rnd();
          key = r < 0.1 ? `flower${Math.floor(rnd() * 4)}` : `grass${Math.floor(rnd() * 4)}`;
          grassTiles.push([tx, ty]);
        }
        rt.draw(key, tx * TILE, ty * TILE);
        if (pondDist(tx, ty) <= 1) {
          const w = this.add.image(tx * TILE_PX, ty * TILE_PX, "water0")
            .setOrigin(0).setScale(PX).setDepth(-999);
          this.waterTiles.push(w);
        }
      }
    }

    const shadowAt = (x: number, y: number, sx: number, sy: number) =>
      this.add.image(x, y, "shadow").setScale(PX * sx, PX * sy).setDepth(y - 1);

    // ต้นไม้
    for (const t of TREES) {
      const f = treeFeet(t);
      shadowAt(f.x, f.y - 2, 2.4, 1.6);
      this.add.image(f.x, f.y, "tree").setOrigin(0.5, 34 / 37).setScale(PX).setDepth(f.y);
    }

    // พุ่มไม้ (ตำแหน่งสุ่มแต่คงที่ทุกเครื่อง)
    const bushRnd = mulberry32(21);
    let placed = 0;
    while (placed < 16 && grassTiles.length) {
      const [tx, ty] = grassTiles[Math.floor(bushRnd() * grassTiles.length)];
      const x = (tx + 0.5) * TILE_PX;
      const y = (ty + 0.9) * TILE_PX;
      if (TREES.some((t) => Math.hypot(treeFeet(t).x - x, treeFeet(t).y - y) < 60)) continue;
      shadowAt(x, y - 1, 1.1, 1);
      this.add.image(x, y, "bush").setOrigin(0.5, 12 / 14).setScale(PX).setDepth(y);
      placed++;
    }

    // น้ำพุ
    this.buildCasino();
    this.fountain = this.add.image(FOUNTAIN.x, FOUNTAIN.y, "fountain0").setScale(PX).setDepth(FOUNTAIN.y + 40);

    // ม้านั่งและโคมไฟ
    for (const [bx, by] of BENCHES) {
      const x = bx * TILE_PX;
      const y = by * TILE_PX;
      shadowAt(x, y - 1, 1.7, 1);
      this.add.image(x, y, "bench").setOrigin(0.5, 11 / 14).setScale(PX).setDepth(y);
    }
    for (const [lx, ly] of LAMPS) {
      const x = lx * TILE_PX;
      const y = ly * TILE_PX;
      this.add.image(x, y, "lamp").setOrigin(0.5, 23 / 26).setScale(PX).setDepth(y);
      this.add.circle(x, y - 58, 40, 0xffe27a, 0.07).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 1);
    }

    // ป้ายชื่อเมือง
    const bx = FOUNTAIN.x;
    const by = (PLAZA.y0 - 0.4) * TILE_PX;
    this.add.image(bx, by, "board").setScale(PX).setDepth(by);
    this.add.text(bx, by, "Town Square", { fontFamily: FONT, fontSize: "16px", color: "#fff4d6", fontStyle: "bold" })
      .setOrigin(0.5).setDepth(by + 1);
  }

  /* ---------------- ตัวละคร ---------------- */

  private buildCasino() {
    const { x, y, width: w, height: h } = CASINO_BUILDING;
    const g = this.add.graphics().setDepth(y + h);
    g.fillStyle(0x101525, .35).fillRect(x + 9, y + h - 9, w + 12, 27);
    g.fillStyle(0x2b1f30).fillRect(x, y + 36, w, h - 36);
    g.fillStyle(0xb77b55).fillRect(x + 9, y + 42, w - 18, h - 48);
    for (let row = y + 54; row < y + h - 6; row += 15) {
      g.fillStyle(0x9d6047).fillRect(x + 9, row, w - 18, 3);
    }
    g.fillStyle(0x302038).fillRect(x - 9, y + 24, w + 18, 27);
    for (let row = 0; row < 5; row++) {
      const inset = (4 - row) * 9;
      g.fillStyle(row % 2 ? 0x6a354b : 0x874353)
        .fillRect(x - 12 + inset, y + row * 9, w + 24 - inset * 2, 9);
    }
    g.fillStyle(0xffd477).fillRect(x - 12, y + 45, w + 24, 6);
    for (const wx of [x + 24, x + w - 57]) {
      g.fillStyle(0x372539).fillRect(wx, y + 75, 33, 33);
      g.fillStyle(0xf7c870).fillRect(wx + 3, y + 78, 27, 27);
      g.fillStyle(0x8b523c).fillRect(wx + 15, y + 78, 3, 27).fillRect(wx + 3, y + 90, 27, 3);
    }
    g.fillStyle(0x382536).fillRect(x + w / 2 - 24, y + h - 51, 48, 51);
    g.fillStyle(0xe3ae66).fillRect(x + w / 2 - 21, y + h - 48, 42, 3);
    g.fillStyle(0x171a29).fillRect(x + w / 2 - 18, y + h - 45, 36, 45);
    g.fillStyle(0xd7aa7b).fillRect(x + w / 2 - 30, y + h, 60, 9);
    this.add.text(x + w / 2, y + 61, "บ้านป๊อกเด้ง", {
      fontFamily: FONT, fontSize: "17px", color: "#ffe27a", backgroundColor: "#352436", padding: { x: 7, y: 2 },
    }).setOrigin(.5).setDepth(y + h + 1);
    const ring = this.add.circle(CASINO_DOOR.x, CASINO_DOOR.y, 22, 0xffe27a, .12)
      .setStrokeStyle(3, 0xffe27a, .7).setDepth(-10);
    this.tweens.add({ targets: ring, alpha: .35, duration: 900, yoyo: true, repeat: -1 });
    this.add.text(CASINO_DOOR.x, CASINO_DOOR.y + 28, "เดินเข้าประตูเพื่อเล่น • ชิปฟรี", {
      fontFamily: FONT, fontSize: "13px", color: "#fff4d6", backgroundColor: "#1b2230cc", padding: { x: 5, y: 3 },
    }).setOrigin(.5, 0).setDepth(CASINO_DOOR.y + 70);
  }

  update(_t: number, dtMs: number) {
    const players = this.room.state?.players;
    if (!players) return;

    const seen = new Set<string>();
    players.forEach((p: PlayerState, id: string) => {
      seen.add(id);
      let av = this.avatars.get(id);
      if (!av) {
        av = this.createAvatar(p, id);
        this.avatars.set(id, av);
        av.container.setPosition(p.x, p.y);
        if (id === this.room.sessionId) this.cameras.main.startFollow(av.container, true, 0.12, 0.12);
      }
      this.moveAvatar(av, p, dtMs);
    });

    for (const [id, av] of this.avatars) {
      if (!seen.has(id)) {
        av.container.destroy();
        this.avatars.delete(id);
      }
    }
  }

  private moveAvatar(av: Avatar, p: PlayerState, dtMs: number) {
    const c = av.container;
    const k = 1 - Math.pow(0.001, dtMs / 1000);
    const nx = c.x + (p.x - c.x) * k;
    const ny = c.y + (p.y - c.y) * k;
    const dx = nx - c.x;
    const dy = ny - c.y;
    const dist = Math.hypot(dx, dy);
    c.setPosition(Math.round(nx), Math.round(ny));
    c.setDepth(c.y);

    let frame = 0;
    if (dist > 0.12) {
      if (Math.abs(dx) > Math.abs(dy)) {
        av.dir = "side";
        av.flip = dx < 0;
      } else {
        av.dir = dy < 0 ? "up" : "down";
      }
      av.walk += dist;
      frame = WALK_SEQ[Math.floor(av.walk / WALK_STEP_PX) % WALK_SEQ.length];
    }
    const key = `ch-${av.look.id}-${av.dir}-${frame}`;
    if (key !== av.texKey) {
      av.sprite.setTexture(key);
      av.texKey = key;
    }
    av.sprite.setFlipX(av.dir === "side" && av.flip);
  }

  private lookFor(p: PlayerState, id: string): Look {
    // ค่า fallback ทำให้ client ใหม่ยังใช้กับ server เวอร์ชันก่อนมีตัวเลือกหน้าตาได้ระหว่าง deploy
    const h = hashString(id + p.name);
    const index = (value: number, count: number, fallback: number) =>
      Number.isInteger(value) ? Math.max(0, Math.min(count - 1, value)) : fallback;
    const hair = index(p.hair, HAIR.length, h % HAIR.length);
    const skin = index(p.skin, SKIN.length, (h >>> 3) % SKIN.length);
    const pants = index(p.pants, PANTS.length, (h >>> 5) % PANTS.length);
    const style = index(p.style, 3, (h >>> 7) % 3);
    return {
      id: `${p.color}-${hair}-${skin}-${pants}-${style}`,
      shirt: "#" + p.color.toString(16).padStart(6, "0"),
      hair: HAIR[hair],
      skin: SKIN[skin],
      pants: PANTS[pants],
      style,
    };
  }

  private createAvatar(p: PlayerState, id: string): Avatar {
    const look = this.lookFor(p, id);
    ensureCharacter(this, look);
    const isMe = id === this.room.sessionId;

    const shadow = this.add.image(0, -1, "shadow").setScale(PX * 1.1, PX);
    const texKey = `ch-${look.id}-down-0`;
    const sprite = this.add.sprite(0, 0, texKey).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(PX);

    const name = this.add.text(0, 6, p.name, {
      fontFamily: FONT, fontSize: "14px", color: isMe ? "#ffe27a" : "#ffffff",
      backgroundColor: "rgba(20,24,36,0.62)", padding: { x: 5, y: 1 },
    }).setOrigin(0.5, 0);

    const bubbleGfx = this.add.graphics();
    const bubbleText = this.add.text(0, 0, "", {
      fontFamily: FONT, fontSize: "15px", color: "#2b2233", align: "center", wordWrap: { width: 170 },
    }).setOrigin(0.5, 0);
    const bubble = this.add.container(0, HEAD_Y, [bubbleGfx, bubbleText]).setVisible(false);

    const emote = this.add.text(0, HEAD_Y, "", { fontSize: "30px" }).setOrigin(0.5, 1).setVisible(false);

    const container = this.add.container(0, 0, [shadow, sprite, name, bubble, emote]);
    return {
      container, sprite, look, bubble, bubbleGfx, bubbleText, emote,
      dir: "down", flip: false, walk: 0, texKey,
    };
  }

  private showBubble(id: string, text: string) {
    const av = this.avatars.get(id);
    if (!av) return;
    av.emote.setVisible(false);
    const t = av.bubbleText.setText(text);
    const w = Math.max(24, t.width) + 14;
    const h = t.height + 10;
    const tail = 6;
    const top = -tail - h;
    t.setPosition(0, top + 5);

    const g = av.bubbleGfx;
    g.clear();
    g.fillStyle(0x2b2233, 1);
    g.fillRect(-w / 2 - 2, top - 2, w + 4, h + 4);
    g.fillTriangle(-6, -tail + 1, 6, -tail + 1, 0, 1);
    g.fillStyle(0xffffff, 1);
    g.fillRect(-w / 2, top, w, h);
    g.fillTriangle(-4, -tail, 4, -tail, 0, -1);

    av.bubble.setVisible(true);
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
