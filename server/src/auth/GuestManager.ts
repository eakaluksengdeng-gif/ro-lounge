import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import type { GuestReady } from "../../../shared/pokdeng";
import { EconomyManager } from "../economy/EconomyManager";
import { requireGame } from "../pokdeng/errors";

interface Guest { playerId: string; sessionId: string; firstIp: string; lastIp: string }
export interface GuestIdentity { playerId: string; sessionId: string; resumed: boolean }

/** IP is context, never an authorization key: shared Wi-Fi and changing IP are safe. */
export class GuestManager {
  private sessions = new Map<string, Guest>();

  constructor(private readonly economy: EconomyManager) {}

  connect(sessionId: unknown, ip: string): GuestIdentity {
    if (sessionId !== undefined && sessionId !== null && sessionId !== "") {
      const identity = this.resume(sessionId, ip);
      return { ...identity, resumed: true };
    }
    const guest: Guest = { playerId: randomUUID(), sessionId: randomUUID(), firstIp: ip, lastIp: ip };
    this.sessions.set(guest.sessionId, guest);
    this.economy.create(guest.playerId);
    return { playerId: guest.playerId, sessionId: guest.sessionId, resumed: false };
  }

  resume(sessionId: unknown, ip?: string): GuestIdentity {
    requireGame(typeof sessionId === "string", "INVALID_SESSION", "Guest session is required");
    const guest = this.sessions.get(sessionId);
    requireGame(guest, "INVALID_SESSION", "Guest session no longer exists; server memory may have restarted");
    if (ip !== undefined) guest.lastIp = ip;
    return { playerId: guest.playerId, sessionId: guest.sessionId, resumed: true };
  }

  ready(identity: GuestIdentity): GuestReady {
    return { ...identity, wallet: this.economy.view(identity.playerId) };
  }
}

export function requestIp(request?: IncomingMessage): string {
  // Enable only behind a reverse proxy that strips/replaces user-supplied forwarding headers.
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request?.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first && isIP(first)) return first;
  }
  return request?.socket.remoteAddress ?? "unknown";
}
