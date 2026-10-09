import type { WalletView } from "../../../shared/pokdeng";
import { requireGame } from "../pokdeng/errors";

interface Wallet { balance: number; holds: Map<string, number> }
export interface Reservation { playerId: string; key: string; amount: number }
export interface Settlement { playerId: string; key: string; delta: number }

/** Synchronous atomic operations for a single Node process. Chips never come from the client. */
export class EconomyManager {
  private wallets = new Map<string, Wallet>();
  private settled = new Set<string>();
  private fishingRewards = new Set<string>();
  private listeners = new Set<(playerId: string, wallet: WalletView) => void>();

  create(playerId: string): void {
    if (!this.wallets.has(playerId)) this.wallets.set(playerId, { balance: 100, holds: new Map() });
  }

  view(playerId: string): WalletView {
    const wallet = this.get(playerId);
    const reserved = [...wallet.holds.values()].reduce((a, b) => a + b, 0);
    return { balance: wallet.balance, reserved, available: wallet.balance - reserved };
  }

  /** Only a verified server-owned catch mints the server-rolled 1–20 chips. No client API. */
  rewardFishingCatch(playerId: string, castId: string, chips: number): boolean {
    requireGame(typeof castId === "string" && castId.length > 0, "BAD_REWARD", "Missing fishing cast");
    requireGame(Number.isSafeInteger(chips) && chips >= 1 && chips <= 20, "BAD_REWARD", "Fishing reward must be 1–20 chips");
    if (this.fishingRewards.has(castId)) return false;
    const wallet = this.get(playerId);
    requireGame(Number.isSafeInteger(wallet.balance + chips), "BAD_REWARD", "Chip balance limit reached");
    wallet.balance += chips;
    this.fishingRewards.add(castId);
    this.notify([playerId]);
    return true;
  }

  /** Validate every wallet first, then replace all holds together (e.g. player + dealer). */
  reserveBatch(reservations: Reservation[]): void {
    const next = new Map<string, Map<string, number>>();
    for (const { playerId, key, amount } of reservations) {
      requireGame(Number.isSafeInteger(amount) && amount >= 0 && key.length > 0, "BAD_AMOUNT", "Invalid reservation");
      const holds = next.get(playerId) ?? new Map(this.get(playerId).holds);
      if (amount === 0) holds.delete(key); else holds.set(key, amount);
      next.set(playerId, holds);
    }
    for (const [id, holds] of next) {
      const total = [...holds.values()].reduce((a, b) => a + b, 0);
      requireGame(Number.isSafeInteger(total) && total <= this.get(id).balance, "INSUFFICIENT_CHIPS", "Not enough available chips for maximum payout");
    }
    for (const [id, holds] of next) this.get(id).holds = holds;
    this.notify([...next.keys()]);
  }

  /** Zero-sum, bounded by holds, idempotent per round; no partially applied payout. */
  settle(roundId: string, entries: Settlement[]): boolean {
    if (this.settled.has(roundId)) return false;
    requireGame(entries.length > 0 && new Set(entries.map(e => e.playerId)).size === entries.length, "BAD_SETTLEMENT", "Duplicate or empty settlement");
    requireGame(entries.reduce((sum, e) => sum + e.delta, 0) === 0, "BAD_SETTLEMENT", "Settlement must conserve chips");
    for (const entry of entries) {
      const wallet = this.get(entry.playerId);
      const hold = wallet.holds.get(entry.key);
      requireGame(hold !== undefined && Number.isSafeInteger(entry.delta) && Math.abs(entry.delta) <= hold, "BAD_SETTLEMENT", "Payout exceeds reserved chips");
      requireGame(Number.isSafeInteger(wallet.balance + entry.delta) && wallet.balance + entry.delta >= 0, "BAD_SETTLEMENT", "Invalid resulting balance");
    }
    for (const entry of entries) {
      const wallet = this.get(entry.playerId);
      wallet.balance += entry.delta;
      wallet.holds.delete(entry.key);
    }
    this.settled.add(roundId);
    this.notify(entries.map(e => e.playerId));
    return true;
  }

  subscribe(listener: (playerId: string, wallet: WalletView) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private get(id: string): Wallet {
    const wallet = this.wallets.get(id);
    requireGame(wallet, "UNKNOWN_WALLET", "Wallet does not exist");
    return wallet;
  }

  private notify(ids: string[]): void {
    for (const id of new Set(ids)) for (const listener of this.listeners) {
      // Delivery failures must never turn a committed wallet operation into a partial game action.
      try { listener(id, this.view(id)); } catch (error) { console.error("[wallet] notification failed", error); }
    }
  }
}
