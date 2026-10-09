import { Client, Room } from "colyseus.js";

// ชนิดข้อมูลให้ตรงกับ server/src/schema/TownState.ts
export interface PlayerState {
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: number;
  hair: number;
  skin: number;
  pants: number;
  style: number;
}

export interface Appearance {
  color: number;
  hair: number;
  skin: number;
  pants: number;
  style: number;
}

export type ChatMsg = { id: string; name: string; text: string };
export type EmoteMsg = { id: string; name: string };

// เปลี่ยน URL ได้ผ่านตัวแปร VITE_SERVER_URL ตอน deploy
const SERVER_URL: string =
  (import.meta as any).env?.VITE_SERVER_URL ?? `ws://${location.hostname}:2567`;

export async function joinTown(name: string, appearance: Appearance): Promise<Room<any>> {
  const client = new Client(SERVER_URL);
  return client.joinOrCreate("town", { name, appearance });
}
