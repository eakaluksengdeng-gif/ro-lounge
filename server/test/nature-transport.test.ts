import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "colyseus.js";
import type { ApiError, GuestReady } from "../../shared/pokdeng";
import type { FishingState, WeatherView } from "../../shared/nature";
import { FISHING_SPOTS } from "../../shared/nature";
import { TownRoom } from "../src/rooms/TownRoom";

function next<T>(room: Room, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { off(); reject(new Error("Missing " + event)); }, 5000);
    const off = room.onMessage<T>(event, value => { clearTimeout(timeout); off(); resolve(value); });
  });
}
async function travel(room: Room, x: number, y: number) {
  const reached = new Promise<void>((resolve, reject) => {
    const check = () => {
      const p = room.state.players.get(room.sessionId);
      if (p && Math.hypot(p.x - x, p.y - y) < 12) { clearTimeout(timeout); room.onStateChange.remove(check); resolve(); }
    };
    const timeout = setTimeout(() => { room.onStateChange.remove(check); reject(new Error("Travel timed out")); }, 5000);
    room.onStateChange(check);
    check();
  });
  room.send("move", { x, y }); await reached;
}
test("wire fishing checks actual position, authenticates owner, keeps cast private and cancels on move/leave", { timeout: 20000 }, async () => {
  const http = createServer();
  const server = new Server({ transport: new WebSocketTransport({ server: http }), greet: false, gracefullyShutdown: false });
  server.define("town", TownRoom);
  const connections: Room[] = [];
  await server.listen(0, "127.0.0.1");
  const sdk = new Client(`ws://127.0.0.1:${(http.address() as AddressInfo).port}`);
  const join = async (options: object) => {
    const room = await sdk.joinOrCreate("town", options);
    room.onMessage("*", () => {}); connections.push(room); return room;
  };
  try {
    const a = await join({ name: "Angler" }), b = await join({ name: "Observer" });
    const auth = next<GuestReady>(a, "auth:ready"); a.send("auth:sync", {}); const guest = await auth;
    const weather = next<WeatherView>(a, "nature:weather"); a.send("nature:sync", {});
    assert.equal((await weather).kind, "sunny");
    assert.equal(a.state.wildlife.size, 13);
    const rejected = next<ApiError>(a, "api:error");
    a.send("fish:cast", { x: FISHING_SPOTS[0].x, y: FISHING_SPOTS[0].y, total: 999 });
    assert.equal((await rejected).code, "NOT_AT_POND");
    const p = a.state.players.get(a.sessionId);
    await travel(a, p.x, 576); await travel(a, 500, 576); await travel(a, 500, 648);
    const cast = next<FishingState>(a, "fish:state"); a.send("fish:cast", {});
    const waiting = await cast;
    assert.equal(waiting.phase, "waiting"); assert.equal(waiting.deadline, null);
    assert.ok(waiting.castId);
    const stolen = next<ApiError>(b, "api:error");
    b.send("fish:reel", { castId: waiting.castId, playerId: guest.playerId });
    assert.equal((await stolen).code, "WRONG_CAST");
    assert.ok(!JSON.stringify(a.state.toJSON()).includes(waiting.castId!));
    assert.ok(!JSON.stringify(b.state.toJSON()).includes(waiting.castId!));
    const cancelled = next<FishingState>(a, "fish:state"); a.send("move", { x: 510, y: 648 });
    assert.equal((await cancelled).phase, "idle");
    const newCast = next<FishingState>(a, "fish:state"); a.send("fish:cast", {});
    await newCast;
    await a.leave();
    const rejoined = await join({ sessionId: guest.sessionId, name: "Returned" });
    const state = next<FishingState>(rejoined, "fish:state"); rejoined.send("fish:sync", {});
    assert.equal((await state).phase, "idle");
  } finally {
    await Promise.allSettled(connections.filter(room => room.connection?.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
});
