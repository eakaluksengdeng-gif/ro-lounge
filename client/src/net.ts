import { Client, Room } from "colyseus.js";
import { bindGuest, guestSession } from "./pokdeng/guest";

// ชนิดข้อมูลให้ตรงกับ server/src/schema/TownState.ts
export interface PlayerState {
  playerId: string;
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
  gender: number;
  fishing: string;
  fishingSpot: number;
}

export interface Appearance {
  color: number;
  hair: number;
  skin: number;
  pants: number;
  style: number;
  gender: number;
}

export type ChatMsg = { id: string; name: string; text: string };
export type EmoteMsg = { id: string; name: string };

// เปลี่ยน URL ได้ผ่านตัวแปร VITE_SERVER_URL ตอน deploy
export const SERVER_URL: string =
  (import.meta as any).env?.VITE_SERVER_URL ?? `ws://${location.hostname}:2567`;

export async function joinTown(name: string, appearance: Appearance): Promise<Room<any>> {
  const client = new Client(SERVER_URL);
  const room = await client.joinOrCreate("town", { name, appearance, sessionId: guestSession() });
  bindGuest(room);
  return room;
}
