import { Room, Client, ServerError } from "colyseus";
import type { IncomingMessage } from "node:http";
import type { PokClientEvents } from "../../../shared/pokdeng";
import { requestIp, type GuestIdentity } from "../auth/GuestManager";
import { GameManager, type GameOptions } from "../pokdeng/GameManager";
import { GameError, objectPayload } from "../pokdeng/errors";
import { casinoAccess, economy, guests } from "../services";

interface JoinOptions { sessionId?: unknown; ticket?: unknown; name?: unknown }

/** Transport adapter only: GameManager is independently testable and owns all game decisions. */
export class PokDengRoom extends Room {
  maxClients = 8;
  private game!: GameManager;
  private unsubscribeWallet?: () => void;

  onCreate() {
    this.game = this.createGame({
      onRemove: id => {
        casinoAccess.release(id, this.roomId);
        for (const client of [...this.clients]) if (this.identity(client).playerId === id) {
          // Explicit acknowledgement is reliable even when an edge proxy delays a close frame.
          client.send("table:left", { wallet: economy.view(id) });
          client.leave(4000); // Colyseus CONSENTED close code, not an empty WebSocket close frame.
        }
      },
    });
    this.unsubscribeWallet = economy.subscribe((id, wallet) => {
      for (const client of this.clients) if (this.identity(client).playerId === id) client.send("wallet:update", wallet);
    });

    const handle = (event: keyof PokClientEvents, action: (id: string, message: unknown, client: Client) => void) => {
      this.onMessage(event, (client, message: unknown) => {
        try {
          this.game.tick(); // Reject late actions even if a timer tick was delayed.
          action(this.identity(client).playerId, message, client);
        } catch (error) {
          if (!(error instanceof GameError)) { console.error(`[pok_deng] ${event} failed`, error); }
          client.send("api:error", { event, code: error instanceof GameError ? error.code : "INTERNAL_ERROR",
            message: error instanceof GameError ? error.message : "Server could not process the request" });
        }
        this.flush();
      });
    };
    handle("auth:sync", (_id, _message, client) => client.send("auth:ready", guests.ready(this.identity(client))));
    handle("wallet:sync", (id, _message, client) => client.send("wallet:update", economy.view(id)));
    handle("table:sync", (id, _message, client) => this.sendState(client, id));
    handle("table:sit", (id, msg) => this.game.sit(id, objectPayload(msg).seat));
    handle("table:stand", id => this.game.stand(id));
    // Active stakes remain binding. Removal/transport departure happen after payout and the result display.
    handle("table:leave", id => this.game.leave(id));
    handle("table:dealer", id => this.game.becomeDealer(id));
    handle("game:bet", (id, msg) => this.game.bet(id, objectPayload(msg).amount));
    handle("game:cancel_bet", id => this.game.cancelBet(id));
    handle("game:start", id => this.game.start(id));
    handle("game:draw", (id, msg) => this.game.draw(id, objectPayload(msg).roundId));
    handle("game:stay", (id, msg) => this.game.stay(id, objectPayload(msg).roundId));
    this.setSimulationInterval(() => {
      this.game.tick();
      this.flush();
      if (this.game.size === 0 && this.clients.length === 0) this.autoDispose = true;
    }, 100);
  }

  onAuth(_client: Client, options: JoinOptions, request?: IncomingMessage): GuestIdentity {
    try {
      const identity = guests.resume(options?.sessionId, requestIp(request));
      casinoAccess.check(identity.playerId, options?.ticket, this.roomId);
      return identity;
    } catch (error) {
      throw new ServerError(403, error instanceof GameError ? error.code : "AUTH_FAILED");
    }
  }

  onJoin(client: Client, options: JoinOptions) {
    const identity = client.auth as GuestIdentity;
    // Consume entry only after successful admission; no await between seat/member checks.
    this.game.tick();
    const previousRoom = casinoAccess.roomFor(identity.playerId);
    casinoAccess.claim(identity.playerId, options?.ticket, this.roomId);
    try {
      this.game.connect(identity.playerId, typeof options?.name === "string" ? options.name.replace(/[\u0000-\u001f]/g, "").trim() || "Guest" : "Guest");
    } catch (error) {
      if (!previousRoom) casinoAccess.release(identity.playerId, this.roomId);
      throw new ServerError(409, error instanceof GameError ? error.code : "JOIN_FAILED");
    }
    client.userData = identity;
    this.autoDispose = false; // Keep a disconnected round alive through its timer and settlement.
    this.sendState(client, identity.playerId);
    this.flush();
  }

  onLeave(client: Client, consented: boolean) {
    const identity = client.userData as GuestIdentity | undefined;
    if (!identity) return;
    this.game.disconnect(identity.playerId);
    if (consented) this.game.leave(identity.playerId);
    this.flush();
    if (this.game.size === 0) this.autoDispose = true;
  }

  onDispose() { this.unsubscribeWallet?.(); this.game.dispose(); }

  protected createGame(options: GameOptions): GameManager { return new GameManager(this.roomId, economy, options); }

  private identity(client: Client): GuestIdentity { return (client.userData ?? client.auth) as GuestIdentity; }

  private sendState(client: Client, id: string) {
    client.send("table:state", this.game.snapshot());
    client.send("game:hand", this.game.privateHand(id));
    client.send("wallet:update", economy.view(id));
  }

  private flush() {
    if (!this.game.takeDirty()) return;
    const publicState = this.game.snapshot();
    for (const client of this.clients) {
      client.send("table:state", publicState);
      client.send("game:hand", this.game.privateHand(this.identity(client).playerId));
    }
  }
}
