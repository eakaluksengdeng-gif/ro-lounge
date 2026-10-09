import { randomUUID } from "node:crypto";
import type { CasinoEntry } from "../../../shared/pokdeng";
import { requireGame } from "./errors";

// Door position uses authoritative TownRoom feet coordinates. Client art/UI comes next.
import { CASINO_DOOR } from "../../../shared/casinoWorld";
export { CASINO_DOOR };
interface Ticket { token: string; expiresAt: number }

/** Single-process membership registry + short-lived, one-use doorway tickets. */
export class CasinoAccess {
  private tickets = new Map<string, Ticket>();
  private tables = new Map<string, string>();

  constructor(private readonly now: () => number = Date.now) {}

  isAtDoor(x: number, y: number): boolean {
    return Math.hypot(x - CASINO_DOOR.x, y - CASINO_DOOR.y) <= CASINO_DOOR.radius;
  }

  enter(playerId: string, x: number, y: number): CasinoEntry {
    requireGame(this.isAtDoor(x, y), "NOT_AT_DOOR", "Walk to the casino entrance first");
    const ticket = { token: randomUUID(), expiresAt: this.now() + 30_000 };
    this.tickets.set(playerId, ticket);
    return { ticket: ticket.token, expiresAt: ticket.expiresAt, roomType: "pok_deng", resumeRoomId: this.tables.get(playerId) };
  }

  check(playerId: string, token: unknown, roomId: string): void {
    const existing = this.tables.get(playerId);
    requireGame(!existing || existing === roomId, "OTHER_TABLE", "This guest already belongs to another table");
    if (existing === roomId) return; // Rejoin a retained seat with the same authenticated UUID.
    const ticket = this.tickets.get(playerId);
    requireGame(ticket && ticket.expiresAt > this.now() && ticket.token === token, "INVALID_ENTRY", "A valid casino entrance ticket is required");
  }

  claim(playerId: string, token: unknown, roomId: string): void {
    this.check(playerId, token, roomId);
    this.tables.set(playerId, roomId);
    this.tickets.delete(playerId);
  }

  release(playerId: string, roomId: string): void {
    if (this.tables.get(playerId) === roomId) this.tables.delete(playerId);
  }

  roomFor(playerId: string): string | undefined { return this.tables.get(playerId); }
}
