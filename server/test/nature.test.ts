import test from "node:test";
import assert from "node:assert/strict";
import { EnvironmentManager } from "../src/nature/EnvironmentManager";
import { FishingManager } from "../src/nature/FishingManager";
import { FISHING_SPOTS, fishingSpotAt } from "../../shared/nature";
import { isBlocked } from "../src/world";
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

test("each caught fish restores exactly 10 chips to an empty wallet, once, without changing holds", () => {
  let now = 0;
  const economy = new EconomyManager();
  economy.create("broke"); economy.create("dealer");
  economy.reserveBatch([{ playerId: "broke", key: "round", amount: 100 }, { playerId: "dealer", key: "round", amount: 100 }]);
  economy.settle("loss", [{ playerId: "broke", key: "round", delta: -100 }, { playerId: "dealer", key: "round", delta: 100 }]);
  assert.equal(economy.view("broke").balance, 0);
  const notifications: number[] = [];
  economy.subscribe((id, wallet) => { if (id === "broke") notifications.push(wallet.balance); });
  const manager = new FishingManager(() => now, () => 0, (id, cast) => economy.rewardFishingCatch(id, cast));
  const spot = FISHING_SPOTS[0];
  manager.cast("broke", "c", spot.x, spot.y);
  const cast = manager.state("broke", "c").castId!;
  now = 4000; manager.tick("broke", "c");
  manager.reel("broke", "c", cast);
  assert.deepEqual(economy.view("broke"), { balance: 10, reserved: 0, available: 10 });
  assert.equal(manager.state("broke", "c").result?.rewardChips, 10);
  assert.throws(() => manager.reel("broke", "c", cast));
  assert.equal(economy.rewardFishingCatch("broke", cast), false);
  assert.deepEqual(notifications, [10]);
  manager.cancel("broke", "c");
  manager.cast("broke", "c", spot.x, spot.y);
  manager.reel("broke", "c", manager.state("broke", "c").castId);
  assert.equal(economy.view("broke").balance, 10); // Early reel does not mint chips.
  manager.cancel("broke", "c");
  economy.reserveBatch([{ playerId: "broke", key: "hold", amount: 10 }]);
  manager.cast("broke", "c", spot.x, spot.y);
  now = 8000; manager.tick("broke", "c");
  manager.reel("broke", "c", manager.state("broke", "c").castId);
  assert.deepEqual(economy.view("broke"), { balance: 20, reserved: 10, available: 10 });
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
  assert.equal(fishingSpotAt(NaN, 0), -1);
  assert.throws(() => fishing.cast("guest", "owner", 720, 540), /fishing sign/);
  assert.throws(() => fishing.cast("guest", "owner", spot.x, spot.y, true), /card table/);
  assert.throws(() => fishing.cast("guest", "owner", 410, 648), /fishing sign/);
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
  now = 4200; manager.reel("guest", "connection", id);
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
  now = 10000;
  assert.throws(() => manager.reel("a", "c", id));
  assert.equal(manager.state("a", "c").result?.reason, "late");
  assert.equal(manager.state("a", "c").total, 0);
  assert.equal(manager.cancel("a", "someone-else"), false);
  assert.equal(manager.cancel("a", "c"), true);
  manager.cast("a", "c", spot.x, spot.y);
  assert.equal(manager.state("a", "c").phase, "waiting");
});
