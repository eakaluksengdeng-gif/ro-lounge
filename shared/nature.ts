export type WeatherKind = "sunny" | "rain" | "snow";
export type AnimalKind = "cat" | "rabbit" | "butterfly" | "bee" | "ladybug";
export interface WildlifeView { kind: AnimalKind; variant: number; x: number; y: number; facing: number; moving: boolean }
export interface WeatherView { kind: WeatherKind; nextChangeAt: number; serverTime: number }
/** Convenience travel/sign anchors only. Fishing is allowed around the entire shore. */
export const FISHING_SPOTS = [
  { x: 456, y: 648, bobberX: 399, bobberY: 648 },
  { x: 264, y: 504, bobberX: 264, bobberY: 560 },
] as const;
export const FISHING_RADIUS = 48;
export const FISHING_POND = { cx: 264, cy: 648, rx: 168, ry: 105.6 } as const;
export interface FishingLocation { bobberX: number; bobberY: number }
export const FISHING_BITE_MS = 8000;
export const FISHING_GAUGE_PERIOD_MS = 2400;
export const FISHING_TARGET_START = .35;
export const FISHING_TARGET_END = .65;
export const FISHING_REWARD_RATES = Array.from({ length: 20 }, (_, index) => ({ chips: index + 1, weight: 20 - index }));
export const FISHING_REWARD_WEIGHT = 210;

/** Triangle wave: server receipt time, not a client-supplied cursor/score, decides a hit. */
export function fishingGaugePosition(startedAt: number, now: number): number {
  const phase = Math.max(0, now - startedAt) % FISHING_GAUGE_PERIOD_MS / FISHING_GAUGE_PERIOD_MS;
  return phase <= .5 ? phase * 2 : (1 - phase) * 2;
}
export function fishingGaugeHit(startedAt: number, now: number): boolean {
  if (now < startedAt) return false;
  const position = fishingGaugePosition(startedAt, now);
  return position >= FISHING_TARGET_START && position <= FISHING_TARGET_END;
}
export function fishingRewardForRoll(roll: number): number {
  if (!Number.isInteger(roll) || roll < 0 || roll >= FISHING_REWARD_WEIGHT) throw new Error("Invalid fishing reward roll");
  for (const entry of FISHING_REWARD_RATES) {
    if (roll < entry.weight) return entry.chips;
    roll -= entry.weight;
  }
  throw new Error("Invalid fishing reward weights");
}
export const FISH_SPECIES = [
  { id: "carp", name: "ปลาตะเพียน", color: "#aed2db" },
  { id: "goldfish", name: "ปลาทอง", color: "#ffbd58" },
  { id: "koi", name: "ปลาคราฟ", color: "#ff9c8d" },
  { id: "bluegill", name: "ปลาบลูกิลล์", color: "#88b9ee" },
] as const;
export type FishId = typeof FISH_SPECIES[number]["id"];
export interface FishCatch { species: FishId; name: string; lengthCm: number }
export interface FishingState {
  phase: "idle" | "waiting" | "bite" | "result";
  castId: string | null;
  deadline: number | null;
  serverTime: number;
  location: FishingLocation | null;
  biteStartedAt: number | null;
  total: number;
  inventory: Partial<Record<FishId, number>>;
  result?: { reason: "caught" | "miss" | "early" | "late" | "cancelled"; fish?: FishCatch; rewardChips?: number };
}
/** Every angle of the elliptical pond, within 48px of shore; never from inside the water. */
export function fishingLocationAt(x: number, y: number): FishingLocation | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const pond = FISHING_POND;
  const dx = x - pond.cx, dy = y - pond.cy;
  const radius = Math.hypot(dx / pond.rx, dy / pond.ry);
  // Match the world's water collision threshold, including its walkable edge margin.
  if (radius < Math.sqrt(.95)) return null;
  const shoreX = dx / radius, shoreY = dy / radius;
  if (Math.hypot(dx - shoreX, dy - shoreY) > FISHING_RADIUS) return null;
  return { bobberX: pond.cx + shoreX * .82, bobberY: pond.cy + shoreY * .82 };
}
