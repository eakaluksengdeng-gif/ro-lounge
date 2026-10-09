// ค่าของโลกเกม ต้องตรงกับ server/src/world.ts (ถ้าแก้ที่นี่ ให้แก้ที่ server ด้วย)

export const PX = 3; // ขยายพิกเซลอาร์ตกี่เท่าบนจอ
export const TILE = 16; // ขนาด tile ในภาพ (พิกเซล)
export const TILE_PX = TILE * PX; // 48 พิกเซลบนจอ

export const TILES_X = 30;
export const TILES_Y = 18;
export const MAP_W = TILES_X * TILE_PX; // 1440
export const MAP_H = TILES_Y * TILE_PX; // 864

// ลานหินกลางเมือง (พิกัด tile)
export const PLAZA = { x0: 11, y0: 5, x1: 18, y1: 12 };
export const PATH_ROWS = [8, 9];
export const PATH_COLS = [14, 15];

// สระน้ำ (พิกัด tile แบบทศนิยม)
export const POND = { cx: 5.5, cy: 13.5, rx: 3.5, ry: 2.2 };

// น้ำพุ (พิกัดโลก พิกเซล)
export const FOUNTAIN = { x: 15 * TILE_PX, y: 9 * TILE_PX };

// ต้นไม้ (พิกัด tile ของช่องที่ต้นตั้งอยู่)
export const TREES: [number, number][] = [
  [1, 2], [4, 1], [7, 3], [9, 1], [3, 5], [7, 6],
  [21, 2], [24, 1], [27, 3], [28, 1], [22, 5], [26, 6],
  [23, 10], [27, 11], [21, 15], [25, 14], [28, 16], [24, 17],
  [11, 15], [13, 16], [0, 11],
];

export const BENCHES: [number, number][] = [
  [12.6, 6.4], [17.4, 6.4], [12.6, 11.6], [17.4, 11.6],
];
export const LAMPS: [number, number][] = [
  [11.5, 5.9], [18.5, 5.9], [11.5, 12.6], [18.5, 12.6],
];

export const treeFeet = (t: [number, number]) => ({
  x: (t[0] + 0.5) * TILE_PX,
  y: (t[1] + 1) * TILE_PX - 6,
});
