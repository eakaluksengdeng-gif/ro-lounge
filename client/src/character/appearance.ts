import type { Appearance } from "../net";
import type { Look } from "../art";

export const SHIRT_COLORS = ["#f28b82", "#fbbc04", "#a7d676", "#78d9ec", "#aecbfa", "#d7aefb", "#fdcfe8"];
export const HAIR_COLORS = ["#3b2a20", "#7a4a2a", "#d9a441", "#c94f4f", "#2d2d3a", "#8e6bd8"];
export const SKIN_COLORS = ["#ffdcc0", "#f2c29b", "#c98b62"];
export const PANTS_COLORS = ["#3d4a7a", "#4a4458", "#6b4f3a"];
export const DEFAULT_LOOK: Appearance = { color: 3, hair: 0, skin: 0, pants: 0, style: 0, gender: 0 };
export const OPTION_COUNTS: Record<keyof Appearance, number> = { color: 7, hair: 6, skin: 3, pants: 3, style: 3, gender: 2 };

export function loadAppearance(): Appearance {
  let raw: Partial<Appearance> | null = null;
  try { raw = JSON.parse(localStorage.getItem("ro-look") ?? "null"); } catch { /* defaults */ }
  const look = { ...DEFAULT_LOOK };
  for (const key of Object.keys(OPTION_COUNTS) as (keyof Appearance)[]) {
    const value = Number(raw?.[key]);
    if (raw?.[key] != null && Number.isInteger(value) && value >= 0 && value < OPTION_COUNTS[key]) look[key] = value;
  }
  return look;
}

export function appearanceToLook(appearance: Appearance): Look {
  const { color, hair, skin, pants, style, gender } = appearance;
  return {
    id: `${parseInt(SHIRT_COLORS[color].slice(1), 16)}-${hair}-${skin}-${pants}-${style}-${gender}`,
    shirt: SHIRT_COLORS[color], hair: HAIR_COLORS[hair], skin: SKIN_COLORS[skin], pants: PANTS_COLORS[pants], style, gender,
  };
}
