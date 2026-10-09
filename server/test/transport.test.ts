import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "colyseus.js";
import type { ApiError, CasinoEntry, GuestReady, PrivateHand, TableState } from "../../shared/pokdeng";
import { TownRoom } from "../src/rooms/TownRoom";
import { PokDengRoom } from "../src/rooms/PokDengRoom";
import { CASINO_DOOR } from "../src/pokdeng/CasinoAccess";

function message<T>(room: Room, event: string, predicate: (payload: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { off(); reject(new Error(`Timed out waiting for ${event}`)); }, 5_000);
    const off = room.onMessage<T>(event, payload => {
      if (!predicate(payload)) return;
      clearTimeout(timeout); off(); resolve(payload);
    });
  });
}

test("real WebSocket auth, doorway, seat errors, private cards, disconnect/rejoin and wallet delivery", { timeout: 15_000 }, async () => {
  const http = createServer();
  const server = new Server({ transport: new WebSocketTransport({ server: http }), greet: false, gracefullyShutdown: false });
  server.define("town", TownRoom); server.define("pok_deng", PokDengRoom);
  const rooms: Room[] = [];
  await server.listen(0, "127.0.0.1");
  const sdk = new Client(`ws://127.0.0.1:${(http.address() as AddressInfo).port}`);
  const watch = (room: Room) => { rooms.push(room); room.onMessage("*", () => {}); return room; };
  try {
    const a = watch(await sdk.joinOrCreate("town", { name: "Dealer",
      appearance: { color: 6, hair: 5, skin: 2, pants: 2, style: 2, gender: 1 } }));
    const b = watch(await sdk.joinOrCreate("town", { name: "Player",
      appearance: { hair: 999, skin: -1, pants: "invalid", style: 99, gender: 999 } }));
    const aAuth = message<GuestReady>(a, "auth:ready"); a.send("auth:sync", {});
    const bAuth = message<GuestReady>(b, "auth:ready"); b.send("auth:sync", {});
    const [ga, gb] = await Promise.all([aAuth, bAuth]);
    assert.notEqual(ga.playerId, gb.playerId);
    assert.equal(ga.wallet.balance, 100);
    assert.equal(gb.wallet.balance, 100);
    const selected = a.state.players.get(a.sessionId);
    assert.deepEqual([selected.color, selected.hair, selected.skin, selected.pants, selected.style, selected.gender],
      [0xfdcfe8, 5, 2, 2, 2, 1], "selected picture options must match the authoritative in-game appearance");
    const invalid = b.state.players.get(b.sessionId);
    assert.deepEqual([invalid.hair, invalid.skin, invalid.pants, invalid.style, invalid.gender], [0, 0, 0, 0, 0]);
    const rejectedDoor = message<ApiError>(a, "api:error"); a.send("casino:enter", {});
    assert.equal((await rejectedDoor).code, "NOT_AT_DOOR");
    await assert.rejects(sdk.joinOrCreate("pok_deng", { sessionId: ga.sessionId, ticket: "forged" }), /INVALID_ENTRY/);

    const aEntry = message<CasinoEntry>(a, "casino:entered");
    const bEntry = message<CasinoEntry>(b, "casino:entered");
    a.send("move", { x: CASINO_DOOR.x, y: CASINO_DOOR.y });
    b.send("move", { x: CASINO_DOOR.x, y: CASINO_DOOR.y });
    const [ea, eb] = await Promise.all([aEntry, bEntry]);
    const dealer = watch(await sdk.joinOrCreate("pok_deng", { sessionId: ga.sessionId, ticket: ea.ticket, name: "Dealer" }));
    const player = watch(await sdk.joinById(dealer.roomId, { sessionId: gb.sessionId, ticket: eb.ticket, name: "Player" }));
    await assert.rejects(sdk.joinById(dealer.roomId, { sessionId: ga.sessionId }), /ALREADY_CONNECTED/);
    const seated = message<TableState>(dealer, "table:state", s => !!s.seats[0]); dealer.send("table:sit", { seat: 0 }); await seated;
    const conflict = message<ApiError>(player, "api:error"); player.send("table:sit", { seat: 0 });
    assert.equal((await conflict).code, "SEAT_TAKEN");
    const malformed = message<ApiError>(player, "api:error"); player.send("table:sit", null);
    assert.equal((await malformed).code, "BAD_PAYLOAD");
    const seatedPlayer = message<TableState>(player, "table:state", s => !!s.seats[1]); player.send("table:sit", { seat: 1 }); await seatedPlayer;
    const badBet = message<ApiError>(player, "api:error"); player.send("game:bet", { amount: "10" });
    assert.equal((await badBet).code, "BAD_BET");
    const bet = message<TableState>(dealer, "table:state", s => s.seats[1]?.bet === 10); player.send("game:bet", { amount: 10 }); await bet;
    const forgedDealer = message<ApiError>(player, "api:error"); player.send("game:start", { playerId: ga.playerId });
    assert.equal((await forgedDealer).code, "NOT_DEALER");

    const publicState = message<TableState>(player, "table:state", s => s.phase === "dealing");
    const dealerHand = message<PrivateHand>(dealer, "game:hand", s => s.cards.length === 2);
    const playerHand = message<PrivateHand>(player, "game:hand", s => s.cards.length === 2);
    dealer.send("game:start", {});
    const [state, dh, ph] = await Promise.all([publicState, dealerHand, playerHand]);
    assert.equal(state.seats[0]?.cards, undefined);
    assert.equal(state.seats[1]?.cards, undefined);
    assert.equal(new Set([...dh.cards, ...ph.cards].map(c => `${c.rank}:${c.suit}`)).size, 4);
    const serialized = JSON.stringify(state);
    assert.ok(!serialized.includes(ga.sessionId) && !serialized.includes(gb.sessionId));

    const offline = message<TableState>(dealer, "table:state", s => s.seats[1]?.connected === false);
    await player.leave(); await offline;
    const rejoined = watch(await sdk.joinById(dealer.roomId, { sessionId: gb.sessionId, name: "Returned" }));
    const restored = message<PrivateHand>(rejoined, "game:hand", s => s.cards.length === 2);
    rejoined.send("table:sync", {});
    assert.deepEqual((await restored).cards, ph.cards);
    const wallet = message<GuestReady>(rejoined, "auth:ready"); rejoined.send("auth:sync", {});
    // A dealer Pok may already have settled by now on a slower CI machine.
    assert.ok([0, 50].includes((await wallet).wallet.reserved));
    const aSync = message<GuestReady>(a, "auth:ready"); a.send("auth:sync", {});
    assert.ok([0, 50].includes((await aSync).wallet.reserved));
  } finally {
    await Promise.allSettled(rooms.filter(room => room.connection?.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
});
