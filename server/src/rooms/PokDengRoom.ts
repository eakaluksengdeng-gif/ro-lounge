import { Room, Client, ServerError } from "colyseus";
import type { IncomingMessage } from "node:http";
import type { PokClientEvents } from "../../../shared/pokdeng";
import { requestIp, type GuestIdentity } from "../auth/GuestManager";
import { GameManager, type GameOptions } from "../pokdeng/GameManager";
import { GameError, objectPayload } from "../pokdeng/errors";
import { casinoAccess, economy, guests, storage } from "../services";

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
          const wallet=economy.view(id);
          storage.deliver(()=>{client.send("table:left", { wallet });client.leave(4000);});
        }
      },
    });
    this.unsubscribeWallet = economy.subscribe((id, wallet) => {
      for (const client of this.clients) if (this.identity(client).playerId === id) storage.deliver(()=>client.send("wallet:update", wallet));
    });

    const handle = (event: keyof PokClientEvents, action: (id: string, message: unknown, client: Client) => void) => {
      this.onMessage(event, async (client, message: unknown) => {
        try {
          await storage.run(()=>{
            this.game.tick(); // Reject late actions even if a timer tick was delayed.
            action(this.identity(client).playerId, message, client);
          });
        } catch (error) {
          if (!(error instanceof GameError)) { console.error(`[pok_deng] ${event} failed`, error); }
          client.send("api:error", { event, code: error instanceof GameError ? error.code : "INTERNAL_ERROR",
            message: error instanceof GameError ? error.message : "Server could not process the request" });
        }
        this.flush();
      });
    };
    handle("auth:sync", (_id, _message, client) => {const ready=guests.ready(this.identity(client));storage.deliver(()=>client.send("auth:ready",ready));});
    handle("wallet:sync", (id, _message, client) => {const wallet=economy.view(id);storage.deliver(()=>client.send("wallet:update",wallet));});
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
      if(storage.busy)return;
      void storage.run(()=>this.game.tick()).then(()=>{
        this.flush();if(this.game.size===0&&this.clients.length===0)this.autoDispose=true;
      }).catch(()=>{});
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

  async onJoin(client: Client, options: JoinOptions) {
    await storage.run(()=>this.joinClient(client,options));
  }
  private joinClient(client:Client,options:JoinOptions) {
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

  async onLeave(client: Client, consented: boolean) {
    const identity = client.userData as GuestIdentity | undefined;
    if (!identity) return;
    await storage.run(()=>{this.game.disconnect(identity.playerId);if(consented)this.game.leave(identity.playerId);});
    this.flush();
    if (this.game.size === 0) this.autoDispose = true;
  }

  onDispose() { this.unsubscribeWallet?.(); this.game.dispose(); }

  protected createGame(options: GameOptions): GameManager { return new GameManager(this.roomId, economy, options); }

  private identity(client: Client): GuestIdentity { return (client.userData ?? client.auth) as GuestIdentity; }

  private sendState(client: Client, id: string) {
    const table=this.game.snapshot(), hand=this.game.privateHand(id),wallet=economy.view(id);
    storage.deliver(()=>{client.send("table:state",table);client.send("game:hand",hand);client.send("wallet:update",wallet);});
  }

  private flush() {
    if (!this.game.takeDirty()) return;
    const publicState = this.game.snapshot();
    for (const client of this.clients) {
      const hand=this.game.privateHand(this.identity(client).playerId);
      storage.deliver(()=>{client.send("table:state", publicState);client.send("game:hand",hand);});
    }
  }
}
