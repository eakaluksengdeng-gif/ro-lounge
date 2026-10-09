// ค่าของโลกเกมฝั่งเซิร์ฟเวอร์ ต้องตรงกับ client/src/world.ts (ถ้าแก้ที่นี่ ให้แก้ที่ client ด้วย)

export const TILE_PX = 48;
export const MAP_W = 30 * TILE_PX; // 1440
export const MAP_H = 18 * TILE_PX; // 864

export const POND = { cx: 5.5, cy: 13.5, rx: 3.5, ry: 2.2 };
export const FOUNTAIN = { x: 15 * TILE_PX, y: 9 * TILE_PX };

const TREES: [number, number][] = [
  [1, 2], [4, 1], [7, 3], [9, 1], [3, 5], [7, 6],
  [21, 2], [24, 1], [27, 3], [28, 1], [22, 5], [26, 6],
  [23, 10], [27, 11], [21, 15], [25, 14], [28, 16], [24, 17],
  [11, 15], [13, 16], [0, 11],
];
const treeFeet = (t: [number, number]) => ({ x: (t[0] + 0.5) * TILE_PX, y: (t[1] + 1) * TILE_PX - 6 });
const TREE_POINTS = TREES.map(treeFeet);

// ขอบเขตที่ตัวละครยืนได้ (เท้า)
export const BOUNDS = { x0: 24, x1: MAP_W - 24, y0: 72, y1: MAP_H - 8 };

export function clampToMap(x: number, y: number) {
  return {
    x: Math.min(BOUNDS.x1, Math.max(BOUNDS.x0, x)),
    y: Math.min(BOUNDS.y1, Math.max(BOUNDS.y0, y)),
  };
}

// จุดที่เดินผ่านไม่ได้: สระน้ำ น้ำพุ ต้นไม้
export function isBlocked(x: number, y: number): boolean {
  const pond = ((x / TILE_PX - POND.cx) / POND.rx) ** 2 + ((y / TILE_PX - POND.cy) / POND.ry) ** 2;
  if (pond < 0.95) return true;
  if (((x - FOUNTAIN.x) / 54) ** 2 + ((y - (FOUNTAIN.y + 18)) / 32) ** 2 < 1) return true;
  for (const t of TREE_POINTS) if (Math.hypot(x - t.x, y - t.y) < 16) return true;
  return false;
}

// จุดเกิด: ลานหินด้านล่างน้ำพุ
export function spawnPoint() {
  return {
    x: FOUNTAIN.x + (Math.random() - 0.5) * 280,
    y: FOUNTAIN.y + 100 + Math.random() * 40,
  };
}
