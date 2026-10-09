import { Client, type Room } from "colyseus.js";
import type { CasinoEntry, PokClientEvents, PokServerEvents } from "../../../shared/pokdeng";
import { bindGuest, guestSession } from "./guest";

export type PokHandlers = { [K in keyof PokServerEvents]?: (payload: PokServerEvents[K]) => void };

/** Call from the future Phaser/UI casino:entered listener. Keep the town connection open. */
export async function joinPokTable(serverUrl: string, entry: CasinoEntry, name: string, handlers: PokHandlers): Promise<Room> {
  const sessionId = guestSession();
  if (!sessionId) throw new Error("Wait for auth:ready before joining a table");
  const client = new Client(serverUrl);
  const options = { sessionId, ticket: entry.ticket, name };
  const room = entry.resumeRoomId
    ? await client.joinById(entry.resumeRoomId, options)
    : await client.joinOrCreate("pok_deng", options);
  bindGuest(room);
  const register = <K extends keyof PokServerEvents>(event: K) => {
    const handler = handlers[event];
    if (handler) room.onMessage<PokServerEvents[K]>(event, payload => handler(payload));
  };
  for (const event of ["auth:ready", "wallet:update", "table:state", "game:hand", "api:error"] as const) register(event);
  room.send("table:sync", {});
  return room;
}

export function sendPok<K extends keyof PokClientEvents>(room: Room, event: K, payload: PokClientEvents[K]): void {
  room.send(event, payload);
}
