import { randomInt, randomUUID } from "node:crypto";
import type { FishingState, FishId, FishingLocation } from "../../../shared/nature";
import { fishingLocationAt, FISH_SPECIES, FISHING_BITE_MS, fishingGaugeHit, fishingRewardForRoll, FISHING_REWARD_WEIGHT } from "../../../shared/nature";
import { requireGame } from "../pokdeng/errors";
import { isBlocked } from "../world";

interface Cast {
  owner: string; id: string; location: FishingLocation; phase: "waiting" | "bite" | "result";
  biteAt: number; biteStartedAt: number | null; deadline: number | null; result?: FishingState["result"];
}
export class FishingManager {
  private casts = new Map<string, Cast>();
  private inventories = new Map<string, Partial<Record<FishId, number>>>();
  constructor(private now: () => number = Date.now, private random: (max: number) => number = randomInt,
    private reward: (id: string, castId: string, chips: number) => boolean = () => true) {}

  cast(id: string, owner: string, x: number, y: number, inCasino = false): void {
    requireGame(!inCasino, "IN_CASINO", "Leave the card table before fishing");
    const location = fishingLocationAt(x, y);
    requireGame(location && !isBlocked(x, y), "NOT_AT_POND", "Walk to the pond shore");
    const current = this.casts.get(id);
    requireGame(!current, "ALREADY_FISHING", "Finish or cancel the current cast first");
    this.casts.set(id, { owner, id: randomUUID(), location, phase: "waiting",
      biteAt: this.now() + 4000 + this.random(4001), biteStartedAt: null, deadline: null });
  }

  /** True only when the owning connection needs a new private state message. */
  tick(id: string, owner: string): boolean {
    const cast = this.casts.get(id);
    if (!cast || cast.owner !== owner) return false;
    const now = this.now();
    if (cast.phase === "waiting" && now >= cast.biteAt) {
      // Start the reaction window when the server actually processes the bite.
      cast.phase = "bite"; cast.biteStartedAt = now; cast.deadline = now + FISHING_BITE_MS; return true;
    }
    if (cast.phase === "bite" && now >= cast.deadline!) { this.finish(cast, "late"); return true; }
    if (cast.phase === "result" && now >= cast.deadline!) { this.casts.delete(id); return true; }
    return false;
  }

  reel(id: string, owner: string, castId: unknown): void {
    this.tick(id, owner);
    const cast = this.casts.get(id);
    requireGame(cast && cast.owner === owner && cast.id === castId, "WRONG_CAST", "This cast has ended");
    requireGame(cast.phase !== "result", "ALREADY_REELED", "A cast can be reeled only once");
    if (cast.phase === "waiting") { this.finish(cast, "early"); return; }
    requireGame(cast.phase === "bite" && this.now() < cast.deadline!, "BITE_ENDED", "The fish got away");
    if (!fishingGaugeHit(cast.biteStartedAt!, this.now())) { this.finish(cast, "miss"); return; }
    const roll = this.random(100);
    const species = FISH_SPECIES[roll < 50 ? 0 : roll < 78 ? 1 : roll < 94 ? 3 : 2];
    const inventory = this.inventories.get(id) ?? {};
    const chips = fishingRewardForRoll(this.random(FISHING_REWARD_WEIGHT));
    requireGame(this.reward(id, cast.id, chips), "ALREADY_REWARDED", "Fishing cast was already rewarded");
    inventory[species.id] = (inventory[species.id] ?? 0) + 1;
    this.inventories.set(id, inventory);
    this.finish(cast, "caught", { species: species.id, name: species.name, lengthCm: 12 + this.random(29) }, chips);
  }

  cancel(id: string, owner: string): boolean {
    const cast = this.casts.get(id);
    if (!cast || cast.owner !== owner) return false;
    this.casts.delete(id); return true;
  }
  publicPhase(id: string, owner: string): string {
    const cast = this.casts.get(id);
    return cast?.owner === owner && cast.phase !== "result" ? cast.phase : "";
  }
  state(id: string, owner: string): FishingState {
    const cast = this.casts.get(id);
    const own = cast?.owner === owner ? cast : undefined;
    const inventory = { ...this.inventories.get(id) };
    return { phase: own?.phase ?? "idle", castId: own?.id ?? null, location: own ? { ...own.location } : null,
      biteStartedAt: own?.biteStartedAt ?? null,
      deadline: own?.deadline ?? null, serverTime: this.now(), inventory,
      total: Object.values(inventory).reduce((sum, count) => sum + (count ?? 0), 0),
      result: own?.result ? { ...own.result, fish: own.result.fish ? { ...own.result.fish } : undefined } : undefined };
  }
  private finish(cast: Cast, reason: NonNullable<FishingState["result"]>["reason"], fish?: NonNullable<FishingState["result"]>["fish"], rewardChips = 0) {
    cast.phase = "result"; cast.deadline = this.now() + 3000;
    cast.result = { reason, fish, rewardChips };
  }
}
