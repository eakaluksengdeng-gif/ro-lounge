import test from "node:test";
import assert from "node:assert/strict";
import { EnvironmentManager } from "../src/nature/EnvironmentManager";
import { FishingManager } from "../src/nature/FishingManager";
import { FISHING_SPOTS, fishingLocationAt, FISHING_POND, fishingGaugePosition, fishingGaugeHit,
  FISHING_REWARD_RATES, FISHING_REWARD_WEIGHT, fishingRewardForRoll } from "../../shared/nature";
import { isBlocked, POND, TILE_PX } from "../src/world";
import { EconomyManager } from "../src/economy/EconomyManager";
import { avatarMotion } from "../../shared/avatarMotion";

test("fractional idle positions converge without walking or changing facing", () => {
  const player = { x: 531.42, y: 612.71, targetX: 531.42, targetY: 612.71 };
  let current = { x: 528, y: 614 };
  for (let i = 0; i < 150; i++) {
    const motion = avatarMotion(current, player, 16);
    assert.equal(motion.walking, false);
    current = motion;
  }
  assert.ok(Math.hypot(current.x - player.x, current.y - player.y) < .000001);
  assert.equal(avatarMotion({ x: 528, y: 614 }, { ...player, targetX: 630 }, 16).walking, true);
});

test("weighted catch rewards restore an empty wallet once without changing holds", () => {
  let now = 0;
  const economy = new EconomyManager();
  economy.create("broke"); economy.create("dealer");
  economy.reserveBatch([{ playerId: "broke", key: "round", amount: 100 }, { playerId: "dealer", key: "round", amount: 100 }]);
  economy.settle("loss", [{ playerId: "broke", key: "round", delta: -100 }, { playerId: "dealer", key: "round", delta: 100 }]);
  assert.equal(economy.view("broke").balance, 0);
  const notifications: number[] = [];
  economy.subscribe((id, wallet) => { if (id === "broke") notifications.push(wallet.balance); });
  const manager = new FishingManager(() => now, () => 0, (id, cast, chips) => economy.rewardFishingCatch(id, cast, chips));
  const spot = FISHING_SPOTS[0];
  manager.cast("broke", "c", spot.x, spot.y);
  const cast = manager.state("broke", "c").castId!;
  now = 4000; manager.tick("broke", "c");
  now = 4600; // Cursor reaches the middle of the red zone.
  manager.reel("broke", "c", cast);
  assert.deepEqual(economy.view("broke"), { balance: 1, reserved: 0, available: 1 });
  assert.equal(manager.state("broke", "c").result?.rewardChips, 1);
  assert.throws(() => manager.reel("broke", "c", cast));
  assert.equal(economy.rewardFishingCatch("broke", cast, 20), false);
  assert.deepEqual(notifications, [1]);
  manager.cancel("broke", "c");
  manager.cast("broke", "c", spot.x, spot.y);
  manager.reel("broke", "c", manager.state("broke", "c").castId);
  assert.equal(economy.view("broke").balance, 1); // Early reel does not mint chips.
  manager.cancel("broke", "c");
  economy.reserveBatch([{ playerId: "broke", key: "hold", amount: 1 }]);
  manager.cast("broke", "c", spot.x, spot.y);
  now = 8600; manager.tick("broke", "c");
  now = 9200;
  manager.reel("broke", "c", manager.state("broke", "c").castId);
  assert.deepEqual(economy.view("broke"), { balance: 2, reserved: 1, available: 1 });
});

test("pond shore accepts every angle, places bobbers in water and rejects inland/water/nonfinite points", () => {
  for (const key of ["cx", "cy", "rx", "ry"] as const) assert.ok(Math.abs(FISHING_POND[key] - POND[key] * TILE_PX) < 1e-9);
  const manager = new FishingManager(() => 0, () => 0);
  const pond = FISHING_POND;
  for (let index = 0; index < 72; index++) {
    const angle = index * Math.PI * 2 / 72;
    const x = pond.cx + (pond.rx + 24) * Math.cos(angle);
    const y = pond.cy + (pond.ry + 24) * Math.sin(angle);
    assert.equal(isBlocked(x, y), false);
    const location = fishingLocationAt(x, y);
    assert.ok(location, "shore angle " + index * 5);
    assert.ok(((location.bobberX - pond.cx) / pond.rx) ** 2 + ((location.bobberY - pond.cy) / pond.ry) ** 2 < .95);
    manager.cast("guest-" + index, "c", x, y);
  }
  for (const [x, y] of [[pond.cx, pond.cy], [410, 648], [720, 540], [NaN, 648], [264, Infinity]]) {
    assert.equal(fishingLocationAt(x, y), null);
    assert.throws(() => manager.cast("bad", "c", x, y));
  }
  const edgeX = pond.cx + pond.rx * .98;
  assert.equal(isBlocked(edgeX, pond.cy), false);
  assert.ok(fishingLocationAt(edgeX, pond.cy), "walkable edge where a click toward the water stops");
  manager.cast("edge", "c", edgeX, pond.cy);
});

test("gauge is a repeating triangle and only its central red zone succeeds", () => {
  const start = 1000;
  assert.equal(fishingGaugePosition(start, 1000), 0);
  assert.equal(fishingGaugePosition(start, 1600), .5);
  assert.equal(fishingGaugePosition(start, 2200), 1);
  assert.equal(fishingGaugePosition(start, 2800), .5);
  assert.equal(fishingGaugePosition(start, 3400), 0);
  for (const time of [999, 1000, 1419, 1781, 2200]) assert.equal(fishingGaugeHit(start, time), false);
  for (const time of [1420, 1600, 1780, 2800, 4000]) assert.equal(fishingGaugeHit(start, time), true);
});

test("all 210 reward rolls have exact decreasing probabilities, with every reward 1–20 reachable", () => {
  const counts = Array(21).fill(0);
  for (let roll = 0; roll < FISHING_REWARD_WEIGHT; roll++) counts[fishingRewardForRoll(roll)]++;
  for (const { chips, weight } of FISHING_REWARD_RATES) {
    assert.equal(counts[chips], weight);
    if (chips > 1) assert.ok(counts[chips] < counts[chips - 1]);
  }
  assert.equal(counts[1], 20); assert.equal(counts[20], 1);
  assert.equal(counts.reduce((sum, value) => sum + value, 0), 210);
  for (const roll of [-1, .5, 210, NaN, Infinity]) assert.throws(() => fishingRewardForRoll(roll));
});

test("a missed gauge grants no fish/chips; a centered hit can award 20 once; invalid rewards fail atomically", () => {
  let now = 0;
  const economy = new EconomyManager(); economy.create("guest");
  const manager = new FishingManager(() => now, max => max === 210 ? 209 : 0,
    (id, cast, chips) => economy.rewardFishingCatch(id, cast, chips));
  const spot = FISHING_SPOTS[0];
  manager.cast("guest", "c", spot.x, spot.y);
  now = 4000; manager.tick("guest", "c");
  manager.reel("guest", "c", manager.state("guest", "c").castId);
  assert.equal(manager.state("guest", "c").result?.reason, "miss");
  assert.equal(manager.state("guest", "c").total, 0);
  assert.equal(economy.view("guest").balance, 100);
  manager.cancel("guest", "c");
  manager.cast("guest", "c", spot.x, spot.y);
  now = 8000; manager.tick("guest", "c"); now = 8600;
  const cast = manager.state("guest", "c").castId!;
  manager.reel("guest", "c", cast);
  assert.equal(manager.state("guest", "c").result?.rewardChips, 20);
  assert.equal(economy.view("guest").balance, 120);
  assert.throws(() => manager.reel("guest", "c", cast));
  assert.equal(economy.rewardFishingCatch("guest", cast, 1), false);
  for (const chips of [0, -1, 21, 999999, 1.5, NaN, Infinity]) assert.throws(() => economy.rewardFishingCatch("guest", "invalid", chips));
  assert.equal(economy.view("guest").balance, 120);
});

test("sun, rain and snow share server time and rotate at exact boundaries", () => {
  const env = new EnvironmentManager(1000, 2000, () => .5);
  assert.equal(env.weather(1000).kind, "sunny");
  assert.equal(env.weather(2999).kind, "sunny");
  assert.equal(env.weather(3000).kind, "rain");
  assert.equal(env.weather(5000).kind, "snow");
  assert.equal(env.weather(7000).kind, "sunny");
  assert.equal(env.weather(5000).nextChangeAt, 7000);
  assert.throws(() => new EnvironmentManager(0, 0));
});

test("13 wildlife wander, rest, stay on land and keep bounded coordinates", () => {
  let seed = 193;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const env = new EnvironmentManager(0, 120000, random);
  const initial = [...env.animals.values()].map(a => [a.x, a.y]);
  assert.equal(env.animals.size, 13);
  let resting = false, moving = false;
  for (let now = 0; now <= 300000; now += 100) {
    env.update(now, 100);
    for (const animal of env.animals.values()) {
      assert.equal(isBlocked(animal.x, animal.y), false, animal.kind);
      assert.ok(animal.x > 0 && animal.x < 1440 && animal.y > 0 && animal.y < 864);
      resting ||= !animal.moving; moving ||= animal.moving;
    }
  }
  assert.ok(resting && moving);
  assert.notDeepEqual([...env.animals.values()].map(a => [a.x, a.y]), initial);
});

test("fishing rejects distant, water, casino and duplicate casts and hides the bite time", () => {
  const fishing = new FishingManager(() => 1000, () => 0);
  const spot = FISHING_SPOTS[0];
  assert.equal(fishingLocationAt(NaN, 0), null);
  assert.throws(() => fishing.cast("guest", "owner", 720, 540), /pond shore/);
  assert.throws(() => fishing.cast("guest", "owner", spot.x, spot.y, true), /card table/);
  assert.throws(() => fishing.cast("guest", "owner", 410, 648), /pond shore/);
  fishing.cast("guest", "owner", spot.x, spot.y);
  assert.throws(() => fishing.cast("guest", "owner", spot.x, spot.y), /current cast/);
  const state = fishing.state("guest", "owner");
  assert.equal(state.phase, "waiting");
  assert.equal(state.deadline, null);
  assert.ok(!JSON.stringify(state).includes("biteAt"));
  assert.equal(fishing.state("guest", "other-tab").castId, null);
});

test("only the owner can reel a live cast, once; catch inventory survives reconnect", () => {
  let now = 0;
  const manager = new FishingManager(() => now, () => 0);
  const spot = FISHING_SPOTS[0];
  manager.cast("guest", "connection", spot.x, spot.y);
  const id = manager.state("guest", "connection").castId;
  assert.throws(() => manager.reel("guest", "other-tab", id), /cast has ended/);
  assert.throws(() => manager.reel("guest", "connection", "fake"), /cast has ended/);
  now = 4000;
  assert.equal(manager.tick("guest", "connection"), true);
  assert.equal(manager.state("guest", "connection").phase, "bite");
  now = 4600; manager.reel("guest", "connection", id);
  assert.equal(manager.state("guest", "connection").total, 1);
  assert.equal(manager.state("guest", "connection").result?.fish?.species, "carp");
  assert.throws(() => manager.reel("guest", "connection", id), /only once/);
  manager.cancel("guest", "connection");
  assert.equal(manager.state("guest", "new-connection").total, 1);
  const copied = manager.state("guest", "new-connection");
  copied.inventory.carp = 100;
  assert.equal(manager.state("guest", "new-connection").total, 1);
});

test("early/late reels award nothing; exact deadline expires; cancelling frees the rod", () => {
  let now = 0;
  const manager = new FishingManager(() => now, () => 0);
  const spot = FISHING_SPOTS[0];
  manager.cast("a", "c", spot.x, spot.y);
  manager.reel("a", "c", manager.state("a", "c").castId);
  assert.equal(manager.state("a", "c").result?.reason, "early");
  assert.equal(manager.state("a", "c").total, 0);
  now = 3000; manager.tick("a", "c");
  manager.cast("a", "c", spot.x, spot.y);
  now = 7000; manager.tick("a", "c");
  const id = manager.state("a", "c").castId;
  now = 15000;
  assert.throws(() => manager.reel("a", "c", id));
  assert.equal(manager.state("a", "c").result?.reason, "late");
  assert.equal(manager.state("a", "c").total, 0);
  assert.equal(manager.cancel("a", "someone-else"), false);
  assert.equal(manager.cancel("a", "c"), true);
  manager.cast("a", "c", spot.x, spot.y);
  assert.equal(manager.state("a", "c").phase, "waiting");
});
