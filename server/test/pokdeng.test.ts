import test from "node:test";
import assert from "node:assert/strict";
import type { Card, Suit } from "../../shared/pokdeng";
import { GuestManager } from "../src/auth/GuestManager";
import { EconomyManager } from "../src/economy/EconomyManager";
import { CasinoAccess, CASINO_DOOR } from "../src/pokdeng/CasinoAccess";
import { createDeck, DEFAULT_RULES, evaluate, shuffledDeck } from "../src/pokdeng/cards";
import { GameManager } from "../src/pokdeng/GameManager";
import { GameError } from "../src/pokdeng/errors";

const card = (rank: number, suit: Suit = "clubs"): Card => ({ rank, suit });
const fails = (action: () => void, code: string) => assert.throws(action, (e: unknown) => e instanceof GameError && e.code === code);
function rigged(hands: Card[][], extra: Card[] = []): Card[] {
  const first = [0, 1].flatMap(pass => hands.map(hand => hand[pass]));
  const prefix = [...first, ...extra];
  const keys = new Set(prefix.map(c => `${c.rank}:${c.suit}`));
  return [...prefix, ...createDeck().filter(c => !keys.has(`${c.rank}:${c.suit}`))];
}

function table(hands = [[card(2), card(2, "hearts")], [card(5), card(2, "diamonds")]], extra: Card[] = []) {
  let clock = 1_000;
  const economy = new EconomyManager();
  const removed: string[] = [];
  for (let i = 0; i < 10; i++) economy.create(`p${i}`);
  const game = new GameManager("test-table", economy, { now: () => clock, deck: () => rigged(hands, extra), onRemove: id => removed.push(id) });
  game.connect("p0", "Dealer"); game.sit("p0", 0);
  game.connect("p1", "Player"); game.sit("p1", 1);
  const advance = (ms: number) => { clock += ms; game.tick(); };
  const action = () => { advance(DEFAULT_RULES.dealingMs); advance(DEFAULT_RULES.checkPokMs); };
  return { game, economy, advance, action, removed };
}

test("guests on one IP have separate wallets; UUID resumes across IP changes without another grant", () => {
  const economy = new EconomyManager(); const guests = new GuestManager(economy);
  const first = guests.connect(undefined, "10.0.0.1");
  const second = guests.connect(undefined, "10.0.0.1");
  assert.notEqual(first.playerId, second.playerId);
  assert.notEqual(first.sessionId, first.playerId);
  assert.equal(economy.view(first.playerId).balance, 100);
  economy.reserveBatch([{ playerId: first.playerId, key: "round", amount: 50 }, { playerId: second.playerId, key: "round", amount: 50 }]);
  economy.settle("round", [{ playerId: first.playerId, key: "round", delta: -20 }, { playerId: second.playerId, key: "round", delta: 20 }]);
  const returned = guests.connect(first.sessionId, "192.0.2.9");
  assert.equal(returned.playerId, first.playerId);
  assert.equal(guests.ready(returned).wallet.balance, 80);
  fails(() => guests.resume(first.playerId), "INVALID_SESSION");
  fails(() => guests.connect("unknown-session", "10.0.0.1"), "INVALID_SESSION");
});

test("reservation updates are atomic; negative, fractional and oversized chips are rejected", () => {
  const economy = new EconomyManager(); economy.create("a"); economy.create("b");
  fails(() => economy.reserveBatch([{ playerId: "a", key: "k", amount: 50 }, { playerId: "b", key: "k", amount: 101 }]), "INSUFFICIENT_CHIPS");
  assert.equal(economy.view("a").reserved, 0);
  for (const amount of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) fails(() => economy.reserveBatch([{ playerId: "a", key: "k", amount }]), "BAD_AMOUNT");
});

test("settlement cannot mint chips, overdraft holds, duplicate guests or pay twice", () => {
  const economy = new EconomyManager(); economy.create("a"); economy.create("b");
  economy.reserveBatch([{ playerId: "a", key: "k", amount: 50 }, { playerId: "b", key: "k", amount: 50 }]);
  fails(() => economy.settle("bad", [{ playerId: "a", key: "k", delta: 1 }, { playerId: "b", key: "k", delta: 1 }]), "BAD_SETTLEMENT");
  fails(() => economy.settle("bad", [{ playerId: "a", key: "k", delta: -51 }, { playerId: "b", key: "k", delta: 51 }]), "BAD_SETTLEMENT");
  fails(() => economy.settle("bad", [{ playerId: "a", key: "k", delta: 5 }, { playerId: "a", key: "k", delta: -5 }]), "BAD_SETTLEMENT");
  const settlement = [{ playerId: "a", key: "k", delta: -25 }, { playerId: "b", key: "k", delta: 25 }];
  assert.equal(economy.settle("ok", settlement), true);
  assert.equal(economy.settle("ok", settlement), false);
  assert.deepEqual(economy.view("a"), { balance: 75, reserved: 0, available: 75 });
  assert.equal(economy.view("b").balance, 125);
});

test("door tickets require authoritative proximity, expire, cannot be stolen or reused across tables", () => {
  let clock = 0; const access = new CasinoAccess(() => clock);
  fails(() => access.enter("a", 0, 0), "NOT_AT_DOOR");
  const entry = access.enter("a", CASINO_DOOR.x, CASINO_DOOR.y);
  fails(() => access.claim("b", entry.ticket, "room"), "INVALID_ENTRY");
  access.claim("a", entry.ticket, "room");
  access.check("a", undefined, "room");
  fails(() => access.claim("a", entry.ticket, "other"), "OTHER_TABLE");
  access.release("a", "room");
  fails(() => access.claim("a", entry.ticket, "room"), "INVALID_ENTRY");
  const expiring = access.enter("a", CASINO_DOOR.x, CASINO_DOOR.y);
  clock = expiring.expiresAt;
  fails(() => access.claim("a", expiring.ticket, "room"), "INVALID_ENTRY");
});

test("shuffle returns exactly 52 unique standard cards", () => {
  const deck = shuffledDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(c => `${c.rank}:${c.suit}`)).size, 52);
  assert.deepEqual([...deck].sort((a, b) => `${a.rank}:${a.suit}`.localeCompare(`${b.rank}:${b.suit}`)), createDeck().sort((a, b) => `${a.rank}:${a.suit}`.localeCompare(`${b.rank}:${b.suit}`)));
});

test("house hand rankings and payouts cover pok, points, two/three deng, tong, straight and sian", () => {
  assert.equal(evaluate([card(5), card(4, "hearts")]).kind, "pok9");
  assert.equal(evaluate([card(5), card(3, "hearts")]).kind, "pok8");
  assert.equal(evaluate([card(13), card(7, "hearts")]).points, 7);
  assert.equal(evaluate([card(2), card(2, "hearts")]).multiplier, 2);
  assert.equal(evaluate([card(5), card(2)]).multiplier, 2);
  assert.equal(evaluate([card(2), card(5), card(10)]).multiplier, 3);
  assert.equal(evaluate([card(3), card(3, "hearts"), card(3, "spades")]).kind, "tong");
  assert.equal(evaluate([card(3), card(3, "hearts"), card(3, "spades")]).multiplier, 5);
  assert.equal(evaluate([card(1), card(2, "hearts"), card(3, "spades")]).kind, "straight");
  assert.equal(evaluate([card(11), card(11, "hearts"), card(12, "spades")]).kind, "sian");
  assert.equal(evaluate([card(12), card(13, "hearts"), card(1, "spades")]).kind, "points");
  const tong = evaluate([card(3), card(3, "hearts"), card(3, "spades")]);
  assert.ok(evaluate([card(5), card(3)]).strength > tong.strength);
});

test("eight-seat capacity, seat races, invalid indices and duplicate connections", () => {
  const { game } = table();
  fails(() => game.sit("p1", 2), "ALREADY_SEATED");
  game.connect("p2", "Second");
  fails(() => game.sit("p2", 0), "SEAT_TAKEN");
  for (const seat of [-1, 8, 2.5, "1", undefined]) fails(() => game.sit("p2", seat), "BAD_SEAT");
  game.sit("p2", 2);
  for (let i = 3; i < 8; i++) { game.connect(`p${i}`, "Guest"); game.sit(`p${i}`, i); }
  fails(() => game.connect("p8", "Ninth"), "TABLE_FULL");
  fails(() => game.connect("p0", "Duplicate"), "ALREADY_CONNECTED");
  assert.equal(game.snapshot().seats.filter(Boolean).length, 8);
});

test("betting validates chip capacity on both sides and frees holds when a bet changes or cancels", () => {
  const { game, economy } = table();
  for (const amount of [0, 9, 10.5, "10", NaN]) fails(() => game.bet("p1", amount), "BAD_BET");
  fails(() => game.bet("p0", 10), "NOT_PLAYER");
  fails(() => game.start("p1"), "NOT_DEALER");
  fails(() => game.start("p0"), "NO_BETS");
  game.bet("p1", 10);
  assert.deepEqual(economy.view("p1"), { balance: 100, reserved: 50, available: 50 });
  game.bet("p1", 20);
  assert.equal(economy.view("p0").reserved, 100);
  game.connect("p2", "Second"); game.sit("p2", 2);
  fails(() => game.bet("p2", 10), "INSUFFICIENT_CHIPS");
  assert.equal(game.snapshot().seats[2]?.bet, 0);
  assert.equal(economy.view("p2").reserved, 0);
  game.cancelBet("p1");
  assert.equal(economy.view("p0").reserved, 0);
  game.bet("p1", 10); game.stand("p0");
  assert.equal(economy.view("p1").reserved, 0);
  assert.equal(game.snapshot().seats[1]?.bet, 0);
});

test("private hand delivery, phase progression, action replay rejection and winner multiplier", () => {
  const { game, economy, action, advance } = table();
  game.bet("p1", 10); game.start("p0");
  assert.equal(game.snapshot().phase, "dealing");
  for (const seat of game.snapshot().seats.filter(Boolean)) {
    assert.equal(seat?.cardCount, 2); assert.equal(seat?.cards, undefined); assert.equal(seat?.value, undefined);
  }
  assert.deepEqual(game.privateHand("p1").cards, [card(5), card(2, "diamonds")]);
  assert.deepEqual(game.privateHand("p0").cards, [card(2), card(2, "hearts")]);
  fails(() => game.stand("p1"), "ROUND_ACTIVE");
  action();
  const round = game.snapshot().roundId!;
  assert.equal(game.snapshot().phase, "action");
  fails(() => game.draw("p1", "previous-round"), "STALE_ROUND");
  game.stay("p1", round);
  fails(() => game.draw("p1", round), "ACTION_NOT_ALLOWED");
  game.stay("p0", round);
  assert.equal(game.snapshot().phase, "showdown");
  assert.equal(economy.view("p1").balance, 110);
  assert.equal(economy.view("p0").balance, 90);
  assert.ok(game.snapshot().seats[0]?.cards);
  const balance = economy.view("p1").balance;
  advance(DEFAULT_RULES.showdownMs);
  assert.equal(game.snapshot().phase, "betting");
  assert.equal(game.snapshot().roundId, null);
  assert.equal(game.snapshot().seats[1]?.cardCount, 0);
  assert.equal(economy.view("p1").balance, balance);
});

test("dealer Pok immediately settles against unrevealed ordinary players", () => {
  const { game, economy, advance } = table([[card(5), card(4, "hearts")], [card(2), card(2, "diamonds")]]);
  game.bet("p1", 10); game.start("p0"); advance(DEFAULT_RULES.dealingMs);
  assert.equal(game.snapshot().phase, "check_pok");
  assert.ok(game.snapshot().seats[0]?.cards);
  assert.equal(game.snapshot().seats[1]?.cards, undefined);
  advance(DEFAULT_RULES.checkPokMs);
  assert.equal(game.snapshot().phase, "showdown");
  assert.equal(economy.view("p0").balance, 110);
  assert.equal(economy.view("p1").balance, 90);
});

test("player Pok is public while dealer stays private and cannot act again", () => {
  const { game, action } = table([[card(2), card(3, "hearts")], [card(5), card(4, "diamonds")]]);
  game.bet("p1", 10); game.start("p0"); action();
  assert.ok(game.snapshot().seats[1]?.cards);
  assert.equal(game.snapshot().seats[0]?.cards, undefined);
  assert.equal(game.privateHand("p1").canDraw, false);
  fails(() => game.draw("p1", game.snapshot().roundId), "ACTION_NOT_ALLOWED");
});

test("below-four hands cannot Stay; deadline auto-draws them and auto-Stays other players", () => {
  const { game, action, advance, economy } = table([[card(2), card(3, "hearts")], [card(1), card(2, "diamonds")]], [card(10, "spades")]);
  game.bet("p1", 10); game.start("p0"); action();
  const round = game.snapshot().roundId!;
  assert.equal(game.privateHand("p1").canStay, false);
  fails(() => game.stay("p1", round), "MUST_DRAW");
  advance(DEFAULT_RULES.actionMs);
  assert.equal(game.snapshot().phase, "showdown");
  assert.equal(game.snapshot().seats[1]?.cardCount, 3);
  assert.equal(game.snapshot().seats[0]?.cardCount, 2);
  assert.equal(economy.view("p0").balance + economy.view("p1").balance, 200);
  fails(() => game.draw("p1", round), "NOT_ACTION_PHASE");
});

test("manual draw adds exactly one card and rejects replay before showdown", () => {
  const { game, action } = table(undefined, [card(10, "spades")]);
  game.bet("p1", 10); game.start("p0"); action();
  const round = game.snapshot().roundId!;
  game.draw("p1", round);
  assert.equal(game.privateHand("p1").cards.length, 3);
  assert.equal(game.snapshot().seats[1]?.cards, undefined);
  fails(() => game.draw("p1", round), "ACTION_NOT_ALLOWED");
});

test("ties push and two-deng dealer winnings use dealer's multiplier", () => {
  for (const [hands, expected] of [
    [[[card(3), card(2, "hearts")], [card(4), card(1, "diamonds")]], 100],
    [[[card(3), card(3, "hearts")], [card(4), card(1, "diamonds")]], 120],
  ] as [Card[][], number][]) {
    const { game, action, economy } = table(hands);
    game.bet("p1", 10); game.start("p0"); action();
    const round = game.snapshot().roundId!;
    game.stay("p0", round); game.stay("p1", round);
    assert.equal(economy.view("p0").balance, expected);
    assert.equal(economy.view("p1").balance, 200 - expected);
  }
});

test("offline players retain stakes, may rejoin privately, settle once and expire after the round", () => {
  const { game, action, advance, economy, removed } = table();
  game.bet("p1", 10); game.start("p0"); action();
  game.leave("p1");
  assert.equal(economy.view("p1").reserved, 50);
  game.connect("p1", "Reconnect");
  assert.equal(game.snapshot().seats[1]?.connected, true);
  assert.equal(game.privateHand("p1").cards.length, 2);
  game.disconnect("p1"); game.disconnect("p0");
  advance(DEFAULT_RULES.actionMs);
  assert.equal(game.snapshot().phase, "showdown");
  assert.equal(economy.view("p1").balance, 110);
  advance(DEFAULT_RULES.reconnectMs);
  assert.equal(game.size, 0);
  assert.deepEqual(new Set(removed), new Set(["p0", "p1"]));
  assert.equal(economy.view("p1").reserved, 0);
});

test("betting disconnect, departure, and room disposal refund holds", () => {
  const { game, economy } = table();
  game.bet("p1", 10); game.disconnect("p1");
  assert.equal(economy.view("p0").reserved, 0);
  game.connect("p1", "Reconnect"); game.bet("p1", 10);
  game.disconnect("p0");
  assert.equal(economy.view("p1").reserved, 0);
  game.connect("p0", "Dealer"); game.bet("p1", 10); game.start("p0");
  game.dispose();
  assert.deepEqual(economy.view("p1"), { balance: 100, reserved: 0, available: 100 });
  assert.equal(game.size, 0);
});

test("tong payouts transfer five times the bet without creating chips or negative wallets", () => {
  const { game, economy, action } = table([[card(3), card(3, "hearts")], [card(2), card(2, "diamonds")]], [card(2, "spades")]);
  game.bet("p1", 10); game.start("p0"); action();
  const round = game.snapshot().roundId!;
  game.stay("p0", round); game.draw("p1", round);
  assert.equal(game.snapshot().seats[1]?.value?.kind, "tong");
  assert.equal(game.snapshot().results[0].multiplier, 5);
  assert.equal(economy.view("p0").balance, 50);
  assert.equal(economy.view("p1").balance, 150);
  assert.equal(economy.view("p0").reserved, 0);
});

test("one dealer and seven bettors deal unique hands and settle the entire table atomically", () => {
  const hands = Array.from({ length: 8 }, (_, i) => [createDeck()[i], createDeck()[i + 20]]);
  const { game, economy, action, advance } = table(hands);
  // Increase dealer bankroll via conserved, reserved transfers from separate wallets.
  for (let i = 8; i < 15; i++) {
    const id = `p${i}`; economy.create(id);
    economy.reserveBatch([{ playerId: id, key: "fund", amount: 50 }, { playerId: "p0", key: "fund", amount: 50 }]);
    economy.settle(`fund${i}`, [{ playerId: id, key: "fund", delta: -50 }, { playerId: "p0", key: "fund", delta: 50 }]);
  }
  for (let i = 2; i < 8; i++) { game.connect(`p${i}`, "Player"); game.sit(`p${i}`, i); }
  for (let i = 1; i < 8; i++) game.bet(`p${i}`, 10);
  assert.equal(economy.view("p0").reserved, 350);
  const before = Array.from({ length: 8 }, (_, i) => economy.view(`p${i}`).balance).reduce((a, b) => a + b, 0);
  game.start("p0");
  const cards = Array.from({ length: 8 }, (_, i) => game.privateHand(`p${i}`).cards).flat();
  assert.equal(new Set(cards.map(c => `${c.rank}:${c.suit}`)).size, 16);
  action();
  if (game.snapshot().phase === "action") advance(DEFAULT_RULES.actionMs);
  assert.equal(game.snapshot().results.length, 7);
  const after = Array.from({ length: 8 }, (_, i) => economy.view(`p${i}`).balance).reduce((a, b) => a + b, 0);
  assert.equal(after, before);
  for (let i = 0; i < 8; i++) {
    assert.equal(economy.view(`p${i}`).reserved, 0);
    assert.ok(economy.view(`p${i}`).balance >= 0);
  }
});
