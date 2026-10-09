import Phaser from "phaser";

// พิกเซลอาร์ตทั้งหมดสร้างจากโค้ด (ภาพของเราเอง ไม่มีปัญหาลิขสิทธิ์)
// ภายหลังอยากเปลี่ยนเป็นภาพที่วาดเอง ให้โหลดรูปมาใช้ key เดียวกันแทนได้

type Ctx = CanvasRenderingContext2D;

const INK = "#2b2233";
const SHOE = "#3a3347";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// amt > 0 ทำให้สว่างขึ้น, amt < 0 ทำให้เข้มขึ้น
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const m = (v: number) => Math.round(v + (t - v) * k);
  return `#${[m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rect(c: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function ellipse(c: Ctx, color: string, cx: number, cy: number, rx: number, ry: number) {
  c.fillStyle = color;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
    }
  }
}

const disc = (c: Ctx, color: string, cx: number, cy: number, r: number) =>
  ellipse(c, color, cx, cy, r, r);

// ใส่เส้นขอบสีเข้มรอบรูป (เฉพาะพิกเซลโปร่งใสที่ติดกับพิกเซลทึบ)
function outline(c: Ctx, w: number, h: number, color: string) {
  const img = c.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const d = img.data;
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3];
  const [r, g, b] = hexToRgb(color);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) === 0 && (alpha(x - 1, y) > 0 || alpha(x + 1, y) > 0 || alpha(x, y - 1) > 0 || alpha(x, y + 1) > 0)) {
        const i = (y * w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
  }
  c.putImageData(img, 0, 0);
}

function canvasTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (c: Ctx) => void,
  withOutline = false,
) {
  if (scene.textures.exists(key)) return;
  const pad = withOutline ? 1 : 0;
  const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2);
  if (!tex) return;
  const c = tex.getContext();
  c.imageSmoothingEnabled = false;
  c.translate(pad, pad);
  draw(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (withOutline) outline(c, w + pad * 2, h + pad * 2, INK);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  tex.refresh();
}

/* ---------------- พื้น ---------------- */

const GRASS = ["#7fd06c", "#78c966", "#84d572", "#7bcb69"];
const FLOWER_COLORS: [string, string][] = [
  ["#ff8fb8", "#ffe27a"],
  ["#ffffff", "#ffd84a"],
  ["#ffd84a", "#ff9f5a"],
  ["#9fc0ff", "#ffffff"],
];

function drawGrass(c: Ctx, i: number) {
  const rnd = mulberry32(100 + i);
  rect(c, GRASS[i % 4], 0, 0, 16, 16);
  for (let n = 0; n < 3; n++) {
    const x = Math.floor(rnd() * 13) + 1;
    const y = Math.floor(rnd() * 13);
    rect(c, "#66b659", x, y, 1, 1);
    rect(c, "#66b659", x + 2, y, 1, 1);
    rect(c, "#66b659", x + 1, y + 1, 1, 1);
  }
  for (let n = 0; n < 3; n++) rect(c, "#98e485", Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
}

function drawFlower(c: Ctx, x: number, y: number, petal: string, center: string) {
  rect(c, petal, x + 1, y, 1, 1);
  rect(c, petal, x, y + 1, 1, 1);
  rect(c, petal, x + 2, y + 1, 1, 1);
  rect(c, petal, x + 1, y + 2, 1, 1);
  rect(c, center, x + 1, y + 1, 1, 1);
}

function drawPath(c: Ctx, i: number) {
  const rnd = mulberry32(200 + i);
  rect(c, "#ead9a8", 0, 0, 16, 16);
  for (let n = 0; n < 6; n++) rect(c, "#d8c48f", Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
  for (let n = 0; n < 4; n++) rect(c, "#f6ebc9", Math.floor(rnd() * 16), Math.floor(rnd() * 16), 2, 1);
}

function drawStone(c: Ctx, i: number) {
  rect(c, "#d9d0bb", 0, 0, 16, 16);
  const off = i === 0 ? 0 : 4;
  c.fillStyle = "#b9af97";
  c.fillRect(0, 7, 16, 1);
  c.fillRect(0, 15, 16, 1);
  c.fillRect((7 + off) % 16, 0, 1, 7);
  c.fillRect((3 + off) % 16, 8, 1, 7);
  c.fillRect((11 + off) % 16, 8, 1, 7);
  c.fillStyle = "#eee7d6";
  for (const [x, y] of [[1, 1], [9, 1], [1, 9], [5, 9], [13, 9]]) c.fillRect((x + off) % 16, y, 3, 1);
}

function drawSand(c: Ctx) {
  const rnd = mulberry32(300);
  rect(c, "#f0e0a4", 0, 0, 16, 16);
  for (let n = 0; n < 7; n++) rect(c, "#dcc986", Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
  for (let n = 0; n < 3; n++) rect(c, "#faf0c8", Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
}

function drawWater(c: Ctx, frame: number) {
  rect(c, "#5db6ea", 0, 0, 16, 16);
  c.fillStyle = "#4aa2da";
  for (const [x, y] of [[1, 3], [9, 8], [4, 13]]) c.fillRect((x + frame * 4) % 14, y, 4, 1);
  c.fillStyle = "#a8e0f8";
  for (const [x, y] of [[6, 2], [12, 6], [2, 10], [10, 13]]) c.fillRect((x + frame * 3) % 15, y, 2, 1);
}

/* ---------------- ของตกแต่ง ---------------- */

function drawTree(c: Ctx) {
  const rnd = mulberry32(5);
  rect(c, "#8a5a34", 14, 24, 5, 9);
  rect(c, "#6e4527", 17, 24, 2, 9);
  rect(c, "#8a5a34", 12, 31, 9, 2);
  disc(c, "#3d9a50", 16, 13, 12);
  disc(c, "#3d9a50", 8, 17, 7);
  disc(c, "#3d9a50", 24, 17, 7);
  disc(c, "#58b95c", 15, 11, 10);
  disc(c, "#58b95c", 9, 16, 5);
  disc(c, "#58b95c", 22, 15, 6);
  disc(c, "#8fe27f", 11, 7, 4);
  disc(c, "#8fe27f", 19, 6, 3);
  for (let n = 0; n < 10; n++) rect(c, "#3d9a50", 6 + Math.floor(rnd() * 20), 8 + Math.floor(rnd() * 14), 2, 1);
}

function drawBush(c: Ctx) {
  disc(c, "#3d9a50", 8, 7, 6);
  disc(c, "#3d9a50", 4, 8, 4);
  disc(c, "#3d9a50", 12, 8, 4);
  disc(c, "#58b95c", 8, 6, 4);
  disc(c, "#8fe27f", 6, 4, 2);
  rect(c, "#ff6b7a", 10, 7, 1, 1);
  rect(c, "#ff6b7a", 5, 9, 1, 1);
}

function drawBench(c: Ctx) {
  rect(c, "#b57a40", 1, 0, 20, 2);
  rect(c, "#dba15f", 1, 0, 20, 1);
  rect(c, "#c58a4d", 0, 3, 22, 3);
  rect(c, "#e2ac68", 0, 3, 22, 1);
  rect(c, "#7a4b27", 2, 6, 2, 5);
  rect(c, "#7a4b27", 18, 6, 2, 5);
}

function drawLamp(c: Ctx) {
  rect(c, "#4f5568", 3, 7, 2, 15);
  rect(c, "#4f5568", 1, 20, 6, 2);
  rect(c, "#ffe27a", 1, 1, 6, 6);
  rect(c, "#fff3b8", 2, 2, 2, 2);
  rect(c, "#4f5568", 0, 0, 8, 1);
}

function drawFountain(c: Ctx, frame: number) {
  ellipse(c, "#aaa28c", 17, 22, 16, 8);
  ellipse(c, "#d8cfba", 17, 20, 16, 8);
  ellipse(c, "#63bdf0", 17, 20, 12, 5.5);
  c.fillStyle = "#a5e2fb";
  for (const [x, y] of [[9, 19], [20, 21], [14, 22], [24, 19]]) c.fillRect(x + frame, y, 2, 1);
  rect(c, "#cfc6b0", 15, 8, 4, 12);
  rect(c, "#aaa28c", 17, 8, 2, 12);
  ellipse(c, "#d8cfba", 17, 9, 6, 3);
  ellipse(c, "#63bdf0", 17, 8.5, 4, 1.8);
  const drops = frame === 0
    ? [[17, 2], [16, 4], [18, 4], [14, 7], [20, 7], [12, 12], [22, 12]]
    : [[17, 3], [15, 5], [19, 5], [13, 8], [21, 8], [11, 14], [23, 14]];
  for (const [x, y] of drops) rect(c, "#ffffff", x, y, 1, 1);
}

function drawBoard(c: Ctx) {
  rect(c, "#7a4b27", 0, 0, 56, 16);
  rect(c, "#b57a40", 1, 1, 54, 14);
  rect(c, "#d79a58", 1, 1, 54, 1);
}

function drawShadow(c: Ctx) {
  ellipse(c, "rgba(20,24,36,0.28)", 7, 2.5, 7, 2.5);
}

/* ---------------- ตัวละคร ---------------- */

export type Dir = "down" | "up" | "side";

export interface Look {
  id: string;
  shirt: string;
  hair: string;
  skin: string;
  pants: string;
  style: number; // 0 ผมสั้น, 1 ผมยาว, 2 มวยผม
  gender?: number; // 0 male novice / 1 female novice; style variants depend on gender.
}

export const CHAR_W = 16;
export const CHAR_H = 22;
// จุดเท้าอยู่ล่างสุดของภาพ (รวมขอบ 1 พิกเซล)
export const CHAR_ORIGIN_Y = (CHAR_H + 1) / (CHAR_H + 2);

function drawChar(c: Ctx, look: Look, dir: Dir, frame: number) {
  const { shirt, hair, skin, pants, style } = look;
  const female = look.gender === 1;
  const shirtD = shade(shirt, -0.2);
  const hairL = shade(hair, 0.2);
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  // ขา
  if (dir !== "side") {
    const legs: [number, number][] = [[5, frame === 1 ? 1 : 0], [8, frame === 2 ? 1 : 0]];
    for (const [x, lift] of legs) {
      rect(c, pants, x, 17, 3, 3 - lift);
      rect(c, SHOE, x, 20 - lift, 3, 2);
    }
  } else if (frame === 0) {
    rect(c, pants, 6, 17, 4, 3);
    rect(c, SHOE, 6, 20, 5, 2);
  } else {
    const far = shade(pants, -0.25);
    const nearForward = frame === 1;
    const draw = (forward: boolean, color: string) => {
      if (forward) {
        rect(c, color, 8, 17, 3, 3);
        rect(c, SHOE, 8, 20, 4, 2);
      } else {
        rect(c, color, 4, 17, 3, 2);
        rect(c, SHOE, 3, 19, 4, 2);
      }
    };
    draw(!nearForward, far); // ขาไกลวาดก่อน
    draw(nearForward, pants);
  }

  // ตัว
  rect(c, shirt, 5, 11, 6, 6);
  rect(c, shirtD, 5, 16, 6, 1);
  rect(c, shade(shirt, 0.18), 5, 11, 6, 1);

  // แขน
  if (dir !== "side") {
    rect(c, shirt, 3, 11 + swing, 2, 3);
    rect(c, skin, 3, 14 + swing, 2, 1);
    rect(c, shirt, 11, 11 - swing, 2, 3);
    rect(c, skin, 11, 14 - swing, 2, 1);
  } else {
    rect(c, shirtD, 7, 11 + swing, 2, 3);
    rect(c, skin, 7, 14 + swing, 2, 1);
  }
  // Distinct novice outfits: collared jacket/trousers or a bow blouse/pleated skirt.
  if (female) {
    rect(c, pants, dir === "side" ? 5 : 4, 16, dir === "side" ? 7 : 8, 3);
    rect(c, shade(pants, -.2), 5, 17, 1, 2);
    rect(c, shade(pants, .15), 9, 17, 1, 2);
    rect(c, skin, 5, 19, 2, 1); rect(c, skin, 9, 19, 2, 1);
    if (dir !== "up") {
      rect(c, "#fff5df", 6, 11, 4, 1);
      rect(c, shade(shirt, .5), 6, 12, 1, 1); rect(c, shade(shirt, .5), 9, 12, 1, 1);
      rect(c, shirtD, 7, 12, 2, 2);
    }
  } else if (dir !== "up") {
    rect(c, "#fff5df", 6, 11, 4, 1);
    rect(c, "#fff5df", 7, 12, 2, 1);
    rect(c, shirtD, 8, 13, 1, 3);
    rect(c, "#ffe0a0", 8, 14);
  }

  // หัว
  const roundCorners = (x0: number, y0: number, x1: number, y1: number) => {
    c.clearRect(x0, y0, 1, 1);
    c.clearRect(x1, y0, 1, 1);
    c.clearRect(x0, y1, 1, 1);
    c.clearRect(x1, y1, 1, 1);
  };
  const bun = () => {
    if (style === 2) {
      if (female) {
        rect(c, hair, 1, 4, 2, 8); rect(c, hair, 13, 4, 2, 8);
        rect(c, "#f8b4c9", 1, 4, 2, 1); rect(c, "#f8b4c9", 13, 4, 2, 1);
      } else {
        for (const x of [4, 7, 10]) rect(c, hair, x, 0, 2, 2);
        rect(c, hairL, 7, 0);
      }
    }
  };

  if (dir === "up") {
    rect(c, skin, 5, 10, 6, 1);
    rect(c, hair, 3, 1, 10, 9);
    roundCorners(3, 1, 12, 9);
    rect(c, hairL, 5, 2, 3, 1);
    if (style === 1) rect(c, hair, 3, 10, 10, 1);
    if (female && style === 1) rect(c, hair, 4, 10, 8, 4);
    if (female && style === 0) rect(c, hair, 3, 8, 10, 3);
    bun();
    return;
  }

  rect(c, skin, 3, 3, 10, 8);
  c.clearRect(3, 10, 1, 1);
  c.clearRect(12, 10, 1, 1);
  rect(c, hair, 3, 1, 10, 3);
  c.clearRect(3, 1, 1, 1);
  c.clearRect(12, 1, 1, 1);
  rect(c, hairL, 5, 2, 3, 1);

  if (dir === "down") {
    rect(c, hair, 3, 4, 2, 2);
    rect(c, hair, 11, 4, 2, 2);
    rect(c, hair, 4, 4, 8, 1);
    rect(c, skin, 8, 4, 1, 1);
    if (style === 1) {
      rect(c, hair, 3, 6, 1, female ? 8 : 3);
      rect(c, hair, 12, 6, 1, female ? 8 : 3);
      if (!female) { rect(c, hairL, 8, 3, 3, 1); rect(c, hair, 9, 4, 3, 1); }
    }
    if (female && style === 0) { rect(c, hair, 3, 6, 1, 5); rect(c, hair, 12, 6, 1, 5); }
    rect(c, INK, 5, 6, 1, 2);
    rect(c, INK, 10, 6, 1, 2);
    rect(c, "#f6a5a0", 4, 8, 1, 1);
    rect(c, "#f6a5a0", 11, 8, 1, 1);
    rect(c, "#c46a6a", 7, 9, 2, 1);
  } else {
    // หันขวา (ด้านซ้ายใช้ flipX)
    rect(c, hair, 3, 4, style === 1 ? 4 : 5, style === 1 ? (female ? 10 : 6) : 5);
    rect(c, hair, 9, 4, 4, 1);
    rect(c, INK, 10, 6, 1, 2);
    rect(c, "#f6a5a0", 11, 8, 1, 1);
  }
  bun();
}

/** DOM previews and game textures share exactly the same pixel renderer. */
export function renderCharacterCanvas(look: Look, dir: Dir = "down", frame = 0): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CHAR_W + 2;
  canvas.height = CHAR_H + 2;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  context.translate(1, 1);
  drawChar(context, look, dir, frame);
  context.setTransform(1, 0, 0, 1, 0, 0);
  outline(context, canvas.width, canvas.height, INK);
  return canvas;
}

export function ensureCharacter(scene: Phaser.Scene, look: Look) {
  const dirs: Dir[] = ["down", "up", "side"];
  for (const d of dirs) {
    for (let f = 0; f < 3; f++) {
      canvasTex(scene, `ch-${look.id}-${d}-${f}`, CHAR_W, CHAR_H, (c) => drawChar(c, look, d, f), true);
    }
  }
}

/* ---------------- รวมทั้งหมด ---------------- */

export function buildWorldTextures(scene: Phaser.Scene) {
  for (let i = 0; i < 4; i++) canvasTex(scene, `grass${i}`, 16, 16, (c) => drawGrass(c, i));
  for (let i = 0; i < 4; i++) {
    canvasTex(scene, `flower${i}`, 16, 16, (c) => {
      drawGrass(c, i);
      const rnd = mulberry32(400 + i);
      const [petal, center] = FLOWER_COLORS[i];
      drawFlower(c, 2 + Math.floor(rnd() * 3), 2 + Math.floor(rnd() * 3), petal, center);
      drawFlower(c, 9 + Math.floor(rnd() * 3), 9 + Math.floor(rnd() * 3), FLOWER_COLORS[(i + 1) % 4][0], FLOWER_COLORS[(i + 1) % 4][1]);
    });
  }
  for (let i = 0; i < 3; i++) canvasTex(scene, `path${i}`, 16, 16, (c) => drawPath(c, i));
  for (let i = 0; i < 2; i++) canvasTex(scene, `stone${i}`, 16, 16, (c) => drawStone(c, i));
  canvasTex(scene, "sand0", 16, 16, drawSand);
  for (let i = 0; i < 2; i++) canvasTex(scene, `water${i}`, 16, 16, (c) => drawWater(c, i));

  canvasTex(scene, "tree", 32, 35, drawTree, true);
  canvasTex(scene, "bush", 16, 12, drawBush, true);
  canvasTex(scene, "bench", 22, 12, drawBench, true);
  canvasTex(scene, "lamp", 8, 24, drawLamp, true);
  for (let i = 0; i < 2; i++) canvasTex(scene, `fountain${i}`, 34, 30, (c) => drawFountain(c, i), true);
  canvasTex(scene, "board", 56, 16, drawBoard, true);
  canvasTex(scene, "shadow", 14, 5, drawShadow);
}
