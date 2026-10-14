import { GuestManager } from "./auth/GuestManager";
import { EconomyManager } from "./economy/EconomyManager";
import { CasinoAccess } from "./pokdeng/CasinoAccess";
import { FishingManager } from "./nature/FishingManager";
import { SnapshotStore } from "./storage/SnapshotStore";
import { WorldManager } from "./world/WorldManager";

// Shared by all TownRoom/PokDengRoom instances in this one Node process.
export let storage = new SnapshotStore();
export let economy = new EconomyManager(storage);
export let guests = new GuestManager(economy, storage);
export const casinoAccess = new CasinoAccess();
export let fishing = new FishingManager(undefined, undefined, (id, castId, chips) => economy.rewardFishingCatch(id, castId, chips), storage);
export let world = new WorldManager(storage);
export async function initializeServices() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url || key) {
    if (!url || !key) throw new Error("Set both Supabase server environment variables");
    storage = new SnapshotStore(); await storage.connectSupabase(url, key);await storage.probeWrite();
  } else {
    if (process.env.RENDER) throw new Error("Production requires Supabase storage; refusing to reset Guests silently");
    storage = new SnapshotStore(process.env.RO_DATA_FILE ?? "data/world.json");
  }
  economy = new EconomyManager(storage); guests = new GuestManager(economy, storage);
  fishing = new FishingManager(undefined, undefined, (id, castId, chips) => economy.rewardFishingCatch(id, castId, chips), storage);
  world = new WorldManager(storage);
}
