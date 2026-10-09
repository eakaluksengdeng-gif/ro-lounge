export type WeatherKind = "sunny" | "rain" | "snow";
export type AnimalKind = "cat" | "rabbit" | "butterfly" | "bee" | "ladybug";
export interface WildlifeView { kind: AnimalKind; variant: number; x: number; y: number; facing: number; moving: boolean }
export interface WeatherView { kind: WeatherKind; nextChangeAt: number; serverTime: number }
export const FISHING_SPOTS = [
  { x: 456, y: 648, bobberX: 399, bobberY: 648 },
  { x: 264, y: 504, bobberX: 264, bobberY: 560 },
] as const;
export const FISHING_RADIUS = 48;
export const FISHING_REWARD_CHIPS = 10;
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
  spot: number | null;
  total: number;
  inventory: Partial<Record<FishId, number>>;
  result?: { reason: "caught" | "early" | "late" | "cancelled"; fish?: FishCatch; rewardChips?: number };
}
export function fishingSpotAt(x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
  return FISHING_SPOTS.findIndex(spot => Math.hypot(x - spot.x, y - spot.y) <= FISHING_RADIUS);
}
