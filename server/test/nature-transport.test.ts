import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "colyseus.js";
import type { ApiError, GuestReady, WalletView } from "../../shared/pokdeng";
import type { FishingState, WeatherView } from "../../shared/nature";
import { FISHING_SPOTS, FISHING_GAUGE_PERIOD_MS } from "../../shared/nature";
import { TownRoom } from "../src/rooms/TownRoom";

function next<T>(room: Room, event: string, matches: (value: T) => boolean = () => true, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { off(); reject(new Error("Missing " + event)); }, timeoutMs);
    const off = room.onMessage<T>(event, value => {
      if (!matches(value)) return;
      clearTimeout(timeout); off(); resolve(value);
    });
  });
}
async function travel(room: Room, x: number, y: number) {
  const reached = new Promise<void>((resolve, reject) => {
    const check = () => {
      const p = room.state.players.get(room.sessionId);
      if (p && Math.hypot(p.x - x, p.y - y) < 12) { clearTimeout(timeout); room.onStateChange.remove(check); resolve(); }
    };
    const timeout = setTimeout(() => {
      room.onStateChange.remove(check);
      const p = room.state.players.get(room.sessionId);
      reject(new Error(`Travel to ${x},${y} timed out at ${p?.x},${p?.y}`));
    }, 5000);
    room.onStateChange(check);
    check();
  });
  room.send("move", { x, y }); await reached;
}
async function startTown() {
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
  return { server, connections, join };
}
async function auth(room: Room) {
  const ready = next<GuestReady>(room, "auth:ready");
  room.send("auth:sync", {}); return ready;
}
async function fishState(room: Room, payload: object = {}) {
  const state = next<FishingState>(room, "fish:state");
  room.send("fish:sync", payload); return state;
}
async function wallet(room: Room) {
  const state = next<WalletView>(room, "wallet:update");
  room.send("wallet:sync", {}); return state;
}
async function goFishing(room: Room) {
  const p = room.state.players.get(room.sessionId);
  await travel(room, p.x, 576); await travel(room, 500, 576); await travel(room, 500, 648); await travel(room, 456, 648);
}
test("wire fishing checks actual position, authenticates owner, keeps cast private and cancels on move/leave", { timeout: 20000 }, async () => {
  const { server, connections, join } = await startTown();
  try {
    const a = await join({ name: "Angler" }), b = await join({ name: "Observer" });
    const auth = next<GuestReady>(a, "auth:ready"); a.send("auth:sync", {}); const guest = await auth;
    const weather = next<WeatherView>(a, "nature:weather"); a.send("nature:sync", {});
    assert.equal((await weather).kind, "sunny");
    assert.equal(a.state.wildlife.size, 13);
    const rejected = next<ApiError>(a, "api:error");
    a.send("fish:cast", { x: FISHING_SPOTS[0].x, y: FISHING_SPOTS[0].y, total: 999 });
    assert.equal((await rejected).code, "NOT_AT_POND");
    await goFishing(a);
    const cast = next<FishingState>(a, "fish:state"); a.send("fish:cast", {});
    const waiting = await cast;
    assert.equal(waiting.phase, "waiting"); assert.equal(waiting.deadline, null);
    assert.ok(waiting.castId);
    const stolen = next<ApiError>(b, "api:error");
    b.send("fish:reel", { castId: waiting.castId, playerId: guest.playerId });
    assert.equal((await stolen).code, "WRONG_CAST");
    assert.ok(!JSON.stringify(a.state.toJSON()).includes(waiting.castId!));
    assert.ok(!JSON.stringify(b.state.toJSON()).includes(waiting.castId!));
    const cancelled = next<FishingState>(a, "fish:state"); a.send("move", { x: 460, y: 648 });
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

test("wire bite belongs to one connection: stolen/forged casts cannot catch, cancel, leak or mint another guest's reward", { timeout: 30000 }, async () => {
  const { server, connections, join } = await startTown();
  try {
    const owner = await join({ name: "Owner" });
    const identity = await auth(owner);
    const attacker = await join({ name: "Other guest" });
    const sibling = await join({ name: "Same guest, another tab", sessionId: identity.sessionId });
    await auth(attacker); await auth(sibling);
    const outsiderMessages: FishingState[] = [];
    const siblingMessages: FishingState[] = [];
    attacker.onMessage<FishingState>("fish:state", value => outsiderMessages.push(value));
    sibling.onMessage<FishingState>("fish:state", value => siblingMessages.push(value));
    await Promise.all([goFishing(owner), goFishing(attacker)]);
    const bite = next<FishingState>(owner, "fish:state", state => state.phase === "bite", 10000);
    const cast = next<FishingState>(owner, "fish:state", state => state.phase === "waiting");
    owner.send("fish:cast", { rewardChips: 999999 });
    const waiting = await cast;
    assert.ok(waiting.castId);
    const stolenId = waiting.castId!;
    // Private sync must ignore a claimed player ID, even with knowledge of the live cast ID.
    const outsider = await fishState(attacker, { playerId: identity.playerId, castId: stolenId });
    assert.equal(outsider.castId, null); assert.equal(outsider.total, 0);
    const otherTab = await fishState(sibling);
    assert.equal(otherTab.castId, null); assert.equal(otherTab.phase, "idle");
    assert.equal((await bite).castId, stolenId);
    const otherCast = next<FishingState>(attacker, "fish:state", state => state.phase === "waiting");
    attacker.send("fish:cast", {});
    const attackerId = (await otherCast).castId;
    assert.notEqual(attackerId, stolenId);
    for (const connection of [attacker, sibling]) {
      const denied = next<ApiError>(connection, "api:error", error => error.event === "fish:reel");
      connection.send("fish:reel", { castId: stolenId, playerId: identity.playerId,
        sessionId: identity.sessionId, owner: owner.sessionId, rewardChips: 999999 });
      assert.equal((await denied).code, "WRONG_CAST");
      const cancelled = next<FishingState>(connection, "fish:state");
      connection.send("fish:cancel", { castId: stolenId, playerId: identity.playerId });
      await cancelled;
    }
    const stillBiting = await fishState(owner);
    assert.equal(stillBiting.phase, "bite"); assert.equal(stillBiting.castId, stolenId);
    // Owner too must submit the exact current UUID, not a missing/malformed/another cast.
    for (const wrongId of [undefined, {}, attackerId]) {
      const denied = next<ApiError>(owner, "api:error", error => error.event === "fish:reel");
      owner.send("fish:reel", { castId: wrongId });
      assert.equal((await denied).code, "WRONG_CAST");
    }
    const caught = next<FishingState>(owner, "fish:state", state => state.result?.reason === "caught");
    const paid = next<WalletView>(owner, "wallet:update", state => state.balance > 100);
    let center = stillBiting.biteStartedAt! + FISHING_GAUGE_PERIOD_MS / 4;
    while (center <= Date.now() + 75) center += FISHING_GAUGE_PERIOD_MS / 2;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, center - Date.now())));
    owner.send("fish:reel", { castId: stolenId, rewardChips: 999999, total: 999999 });
    const catchState = await caught;
    assert.equal(catchState.total, 1);
    const chips = catchState.result!.rewardChips!;
    assert.ok(chips >= 1 && chips <= 20);
    assert.equal((await paid).balance, 100 + chips);
    const replay = next<ApiError>(owner, "api:error", error => error.event === "fish:reel");
    owner.send("fish:reel", { castId: stolenId });
    assert.equal((await replay).code, "ALREADY_REELED");
    assert.equal((await fishState(owner)).total, 1);
    assert.equal((await wallet(owner)).balance, 100 + chips);
    assert.equal((await fishState(attacker)).total, 0);
    assert.equal((await wallet(attacker)).balance, 100);
    // Same guest may see its saved inventory/wallet, but never the other connection's live cast.
    assert.equal((await fishState(sibling)).total, 1);
    assert.equal((await wallet(sibling)).balance, 100 + chips);
    assert.ok(outsiderMessages.every(state => state.castId !== stolenId && state.total === 0));
    assert.ok(siblingMessages.every(state => state.castId === null && state.phase === "idle"));
    assert.ok(!JSON.stringify(attacker.state.toJSON()).includes(stolenId));
    await owner.leave();
    const returned = await join({ name: "Returned owner", sessionId: identity.sessionId });
    const saved = await fishState(returned);
    assert.equal(saved.phase, "idle"); assert.equal(saved.total, 1);
    const stale = next<ApiError>(returned, "api:error");
    returned.send("fish:reel", { castId: stolenId });
    assert.equal((await stale).code, "WRONG_CAST");
    assert.equal((await wallet(returned)).balance, 100 + chips);
  } finally {
    await Promise.allSettled(connections.filter(room => room.connection?.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
});

test("wire casts work on north/west/south/east shores; a forged centered cursor cannot override a real miss", { timeout: 40000 }, async () => {
  const { server, connections, join } = await startTown();
  try {
    const room = await join({ name: "Around the pond" });
    await auth(room);
    const p = room.state.players.get(room.sessionId);
    const shores = [
      { route: [[p.x, 576], [500, 576], [500, 480], [264, 480], [264, 504]], side: "north" },
      { route: [[264, 480], [72, 480], [72, 648]], side: "west" },
      { route: [[72, 792], [264, 792]], side: "south" },
      { route: [[456, 792], [456, 648]], side: "east" },
    ];
    for (const shore of shores) {
      for (const [x, y] of shore.route) await travel(room, x, y);
      const cast = next<FishingState>(room, "fish:state", state => state.phase === "waiting");
      room.send("fish:cast", {});
      const state = await cast;
      assert.ok(state.location, shore.side);
      const live = room.state.players.get(room.sessionId);
      if (shore.side === "north") assert.ok(state.location.bobberY > live.y);
      if (shore.side === "south") assert.ok(state.location.bobberY < live.y);
      if (shore.side === "west") assert.ok(state.location.bobberX > live.x);
      if (shore.side === "east") assert.ok(state.location.bobberX < live.x);
      const cancel = next<FishingState>(room, "fish:state", state => state.phase === "idle");
      room.send("fish:cancel", {}); await cancel;
    }
    const bite = next<FishingState>(room, "fish:state", state => state.phase === "bite", 10000);
    room.send("fish:cast", {});
    const live = await bite;
    const miss = next<FishingState>(room, "fish:state", state => state.phase === "result");
    room.send("fish:reel", { castId: live.castId, cursor: .5, hit: true,
      timestamp: live.biteStartedAt! + 600, rewardChips: 20 });
    const failed = await miss;
    assert.equal(failed.result?.reason, "miss");
    assert.equal(failed.result?.rewardChips, 0);
    assert.equal(failed.total, 0);
    assert.equal((await wallet(room)).balance, 100);
  } finally {
    await Promise.allSettled(connections.filter(room => room.connection?.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
});
