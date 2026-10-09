import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "colyseus.js";
import type { ApiError, CasinoEntry, GuestReady, PrivateHand, TableState, WalletView } from "../../shared/pokdeng";
import { TownRoom } from "../src/rooms/TownRoom";
import { PokDengRoom } from "../src/rooms/PokDengRoom";
import { CASINO_DOOR } from "../src/pokdeng/CasinoAccess";
import { GameManager, type GameOptions } from "../src/pokdeng/GameManager";
import { createDeck, DEFAULT_RULES } from "../src/pokdeng/cards";
import { economy } from "../src/services";

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

test("wire repeated rounds: queued exit pays the dealer, remaining guest plays on, wallets survive table exit/rejoin", { timeout: 20_000 }, async () => {
  class FastPokRoom extends PokDengRoom {
    protected createGame(options: GameOptions) {
      return new GameManager(this.roomId, economy, { ...options,
        rules: { ...DEFAULT_RULES, dealingMs: 300, checkPokMs: 200, actionMs: 300, showdownMs: 300, bettingMs: 500 },
        deck: () => {
          // Dealer always Pok 9, against either one or two ordinary hands.
          const deck = createDeck();
          const prefix = [deck[4], deck[1], deck[2], deck[16], deck[27], deck[40]];
          const keys = new Set(prefix.map(c => `${c.rank}:${c.suit}`));
          return [...prefix, ...deck.filter(c => !keys.has(`${c.rank}:${c.suit}`))];
        },
      });
    }
  }
  const http = createServer();
  const server = new Server({ transport: new WebSocketTransport({ server: http }), greet: false, gracefullyShutdown: false });
  server.define("town", TownRoom); server.define("pok_deng", FastPokRoom);
  const rooms: Room[] = [];
  await server.listen(0, "127.0.0.1");
  const sdk = new Client(`ws://127.0.0.1:${(http.address() as AddressInfo).port}`);
  const watch = (room: Room) => { rooms.push(room); room.onMessage("*", () => {}); return room; };
  try {
    const towns = await Promise.all(["Dealer", "Leaving", "Remaining"].map(async name => watch(await sdk.joinOrCreate("town", { name }))));
    const guests = await Promise.all(towns.map(room => { const ready = message<GuestReady>(room, "auth:ready"); room.send("auth:sync", {}); return ready; }));
    const entries = await Promise.all(towns.map(room => {
      const entry = message<CasinoEntry>(room, "casino:entered"); room.send("move", { x: CASINO_DOOR.x, y: CASINO_DOOR.y }); return entry;
    }));
    const dealer = watch(await sdk.joinOrCreate("pok_deng", { sessionId: guests[0].sessionId, ticket: entries[0].ticket }));
    const leaving = watch(await sdk.joinById(dealer.roomId, { sessionId: guests[1].sessionId, ticket: entries[1].ticket }));
    const remaining = watch(await sdk.joinById(dealer.roomId, { sessionId: guests[2].sessionId, ticket: entries[2].ticket }));
    const players = [dealer, leaving, remaining];
    for (let seat = 0; seat < 3; seat++) {
      const seated = message<TableState>(players[seat], "table:state", state => !!state.seats[seat]);
      players[seat].send("table:sit", { seat }); await seated;
    }
    for (const [seat, room] of [[1, leaving], [2, remaining]] as const) {
      const bet = message<TableState>(room, "table:state", state => state.seats[seat]?.bet === 10);
      room.send("game:bet", { amount: 10 }); await bet;
    }
    const first = message<TableState>(remaining, "table:state", state => state.phase === "dealing");
    dealer.send("game:start", {}); const firstState = await first;
    const playerPaid = message<WalletView>(towns[1], "wallet:update", wallet => wallet.balance === 90 && wallet.reserved === 0);
    const dealerPaid = message<WalletView>(towns[0], "wallet:update", wallet => wallet.balance === 120 && wallet.reserved === 0);
    const departed = new Promise<void>(resolve => leaving.onLeave(() => resolve()));
    const second = message<TableState>(remaining, "table:state", state => state.roundNumber === 2 && state.phase === "dealing");
    const queued = message<TableState>(remaining, "table:state", state => state.seats[1]?.leaving === true);
    leaving.send("table:leave", {}); await queued;
    await Promise.all([playerPaid, dealerPaid, departed]);
    const secondState = await second;
    assert.equal(secondState.seats[1], null);
    assert.equal(secondState.seats[2]?.bet, 10);
    assert.notEqual(secondState.roundId, firstState.roundId);
    assert.equal(secondState.seats[0]?.cards, undefined);
    assert.equal(secondState.seats[2]?.cards, undefined);
    const resumedTown = watch(await sdk.joinOrCreate("town", { sessionId: guests[1].sessionId, name: "Returned" }));
    const auth = message<GuestReady>(resumedTown, "auth:ready"); resumedTown.send("auth:sync", {});
    assert.equal((await auth).wallet.balance, 90);
    // The former guest can leave the door: access was released after their binding round.
    const moved = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Departed guest remained frozen")), 3000);
      const check = setInterval(() => {
        const p = towns[1].state.players.get(towns[1].sessionId);
        if (p && p.y > CASINO_DOOR.y + 40) { clearInterval(check); clearTimeout(timeout); resolve(); }
      }, 50);
    });
    towns[1].send("move", { x: CASINO_DOOR.x, y: CASINO_DOOR.y + 72 }); await moved;
  } finally {
    await Promise.allSettled(rooms.filter(room => room.connection?.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  }
});
