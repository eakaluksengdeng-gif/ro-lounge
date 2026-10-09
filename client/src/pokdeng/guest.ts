import type { Room } from "colyseus.js";
import type { GuestReady, WalletView } from "../../../shared/pokdeng";

export const GUEST_STORAGE_KEY = "ro-guest-session";
let currentSession: string | undefined;

/** User-triggered only: memory-only servers forget guest credentials on restart. */
export function forgetGuest(): void {
  currentSession = undefined;
  try { localStorage.removeItem(GUEST_STORAGE_KEY); } catch { /* ignore */ }
}

export function guestSession(): string | undefined {
  if (currentSession) return currentSession;
  try { return localStorage.getItem(GUEST_STORAGE_KEY) || undefined; } catch { return undefined; }
}

/** Install immediately after join and then request sync: don't depend on join-time event timing. */
export function bindGuest(room: Room, onWallet?: (wallet: WalletView) => void): void {
  room.onMessage("auth:ready", (guest: GuestReady) => {
    currentSession = guest.sessionId;
    try { localStorage.setItem(GUEST_STORAGE_KEY, guest.sessionId); } catch { /* Remains usable for this page lifetime. */ }
    onWallet?.(guest.wallet);
  });
  room.onMessage("wallet:update", (wallet: WalletView) => onWallet?.(wallet));
  room.send("auth:sync", {});
}
