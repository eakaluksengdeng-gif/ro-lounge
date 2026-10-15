import { randomInt, randomUUID } from "node:crypto";
import type { FishingState, FishId, FishingLocation } from "../../../shared/nature";
import { fishingLocationAt, FISH_SPECIES, FISHING_BITE_MS, fishingGaugeHit, fishingRewardForRoll, FISHING_REWARD_WEIGHT } from "../../../shared/nature";
import { requireGame } from "../pokdeng/errors";
import { isBlocked } from "../world";
import { beachFishingLocation, worldBlocked, type MapId } from "../../../shared/regions";
import type { SnapshotStore } from "../storage/SnapshotStore";

interface Cast {
  owner: string; id: string; location: FishingLocation; phase: "waiting" | "bite" | "result";
  biteAt: number; biteStartedAt: number | null; deadline: number | null; result?: FishingState["result"]; map: MapId;
}
export class FishingManager {
  private casts = new Map<string, Cast>();
  private inventories = new Map<string, Partial<Record<FishId, number>>>();
  private discoveries=new Map<string,FishId[]>();
  constructor(private now: () => number = Date.now, private random: (max: number) => number = randomInt,
    private reward: (id: string, castId: string, chips: number) => boolean = () => true, private store?: SnapshotStore) {
      this.inventories = new Map(Object.entries(store?.get<Record<string, Partial<Record<FishId, number>>>>("fish", {}) ?? {}));
      this.discoveries=new Map(Object.entries(store?.get<Record<string,FishId[]>>('fishDiscoveries',{})??{}));
    }

  cast(id: string, owner: string, x: number, y: number, inCasino = false, map: MapId = "town"): void {
    requireGame(!inCasino, "IN_CASINO", "Leave the card table before fishing");
    const location = map === "town" ? fishingLocationAt(x, y) : map === "beach" ? beachFishingLocation(x, y) : null;
    requireGame(location && !(map === "town" ? isBlocked(x, y) : worldBlocked(map, x, y)), "NOT_AT_POND", "Walk to the pond shore or beach shore");
    const current = this.casts.get(id);
    requireGame(!current, "ALREADY_FISHING", "Finish or cancel the current cast first");
    this.casts.set(id, { owner, id: randomUUID(), location, phase: "waiting",
      biteAt: this.now() + 4000 + this.random(4001), biteStartedAt: null, deadline: null, map });
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

  reel(id: string, owner: string, castId: unknown): boolean {
    this.tick(id, owner);
    const cast = this.casts.get(id);
    requireGame(cast && cast.owner === owner && cast.id === castId, "WRONG_CAST", "This cast has ended");
    requireGame(cast.phase !== "result", "ALREADY_REELED", "A cast can be reeled only once");
    if (cast.phase === "waiting") { this.finish(cast, "early"); return false; }
    requireGame(cast.phase === "bite" && this.now() < cast.deadline!, "BITE_ENDED", "The fish got away");
    if (!fishingGaugeHit(cast.biteStartedAt!, this.now())) { this.finish(cast, "miss"); return false; }
    const roll = this.random(100);
    const species = FISH_SPECIES[cast.map === "beach" ? (roll < 65 ? 4 : roll < 93 ? 5 : 6) : roll < 50 ? 0 : roll < 78 ? 1 : roll < 94 ? 3 : 2];
    const inventory = this.inventories.get(id) ?? {};
    const chips = fishingRewardForRoll(this.random(FISHING_REWARD_WEIGHT));
    requireGame(this.reward(id, cast.id, chips), "ALREADY_REWARDED", "Fishing cast was already rewarded");
    inventory[species.id] = (inventory[species.id] ?? 0) + 1;
    this.inventories.set(id, inventory);
    this.discoveries.set(id,[...new Set([...this.discovered(id),species.id])]);this.store?.set('fishDiscoveries',Object.fromEntries(this.discoveries));
    this.store?.set("fish", Object.fromEntries(this.inventories));
    this.finish(cast, "caught", { species: species.id, name: species.name, lengthCm: 12 + this.random(29) }, chips);
    return true;
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
    return { discovered:this.discovered(id),phase: own?.phase ?? "idle", castId: own?.id ?? null, location: own ? { ...own.location } : null,
      biteStartedAt: own?.biteStartedAt ?? null,
      deadline: own?.deadline ?? null, serverTime: this.now(), inventory,
      total: Object.values(inventory).reduce((sum, count) => sum + (count ?? 0), 0),
      result: own?.result ? { ...own.result, fish: own.result.fish ? { ...own.result.fish } : undefined } : undefined };
  }
  holdings(id:string){return {...this.inventories.get(id)};}
  private discovered(id:string):FishId[]{return [...new Set([...(this.discoveries.get(id)??[]),...FISH_SPECIES.filter(f=>(this.inventories.get(id)?.[f.id]??0)>0).map(f=>f.id)])];}
  consume(id:string,cost:Record<string,number>){
    const inventory=this.holdings(id);for(const [key,n]of Object.entries(cost))requireGame(FISH_SPECIES.some(f=>f.id===key)&&Number.isSafeInteger(n)&&n>0&&(inventory[key as FishId]??0)>=n,'MISSING_ITEMS','ปลาสำหรับส่งยังไม่พอ');
    this.discoveries.set(id,this.discovered(id));for(const [key,n]of Object.entries(cost))inventory[key as FishId]=(inventory[key as FishId]??0)-n;
    this.store?.set('fishDiscoveries',Object.fromEntries(this.discoveries));this.inventories.set(id,inventory);this.store?.set('fish',Object.fromEntries(this.inventories));
  }
  private finish(cast: Cast, reason: NonNullable<FishingState["result"]>["reason"], fish?: NonNullable<FishingState["result"]>["fish"], rewardChips = 0) {
    cast.phase = "result"; cast.deadline = this.now() + 3000;
    cast.result = { reason, fish, rewardChips };
  }
}
