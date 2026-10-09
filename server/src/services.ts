import { GuestManager } from "./auth/GuestManager";
import { EconomyManager } from "./economy/EconomyManager";
import { CasinoAccess } from "./pokdeng/CasinoAccess";

// Shared by all TownRoom/PokDengRoom instances in this one Node process.
export const economy = new EconomyManager();
export const guests = new GuestManager(economy);
export const casinoAccess = new CasinoAccess();
