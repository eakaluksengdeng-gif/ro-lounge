import { Room, Client, ServerError } from "colyseus";
import type { IncomingMessage } from "node:http";
import { requestIp, type GuestIdentity } from "../auth/GuestManager";
import { CASINO_DOOR } from "../pokdeng/CasinoAccess";
import { GameError } from "../pokdeng/errors";
import { casinoAccess, economy, guests, fishing, storage, world } from "../services";
import { Player, TownState, Wildlife } from "../schema/TownState";
import { EnvironmentManager } from "../nature/EnvironmentManager";
import { objectPayload } from "../pokdeng/errors";
import { clampToMap, isBlocked, spawnPoint } from "../world";
import { mapId, destination, exitDirection, arrival, worldBlocked, boatPosition, type MapId } from "../../../shared/regions";

// ค่าตั้งต้น ปรับได้ตามต้องการ
const TICK_MS = 50;
const SPEED = 180; // พิกเซลต่อวินาที
const CHAT_MAX_LEN = 120;
const CHAT_COOLDOWN_MS = 700;
const EMOTES = new Set(["happy", "sad", "love", "wave", "angry", "sleepy"]);
const COLORS = [0xf28b82, 0xfbbc04, 0xa7d676, 0x78d9ec, 0xaecbfa, 0xd7aefb, 0xfdcfe8];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function cleanName(raw: unknown): string {
  const s = String(raw ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 16);
  return s || "Guest" + Math.floor(Math.random() * 1000);
}

function optionIndex(raw: unknown, count: number, fallback = 0): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < count ? n : fallback;
}

interface JoinOptions {
  name?: string;
  sessionId?: unknown;
  appearance?: {
    color?: number;
    hair?: number;
    skin?: number;
    pants?: number;
    style?: number;
    gender?: number;
  };
}

export class TownRoom extends Room<TownState> {
  maxClients = 50;
  private lastChat = new Map<string, number>();
  private atDoor = new Set<string>();
  private unsubscribeWallet?: () => void;
  private environment!: EnvironmentManager;
  private natureElapsed = 0;
  private worldElapsed = 0;
  private pendingActions = new Set<string>();

  async onAuth(_client: Client, options: JoinOptions, request?: IncomingMessage): Promise<GuestIdentity> {
    try { return await storage.run(() => guests.connect(options?.sessionId, requestIp(request))); }
    catch (error) { throw new ServerError(403, error instanceof GameError ? error.code : "AUTH_FAILED"); }
  }

  onCreate() {
    this.setState(new TownState());
    const phaseMs = Number(process.env.RO_WEATHER_PHASE_MS ?? 120000);
    this.environment = new EnvironmentManager(Date.now(), phaseMs);
    for (const [id, animal] of this.environment.animals) {
      const value = new Wildlife();
      value.kind = animal.kind; value.variant = animal.variant; value.x = animal.x; value.y = animal.y;
      this.state.wildlife.set(id, value);
    }
    const fishEvent = (event: string, action: (client: Client, p: Player, message: unknown) => void) => {
      this.onMessage(event, async (client, message: unknown) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        try { await storage.run(() => action(client, p, message)); }
        catch (error) {
          client.send("api:error", { event, code: error instanceof GameError ? error.code : "FISH_ERROR",
            message: error instanceof GameError ? error.message : "Could not process fishing request" });
        }
        this.sendFishing(client, p);
      });
    };
    fishEvent("fish:sync", () => {});
    fishEvent("fish:cast", (client, p) => {
      if(p.activity==="boat")throw new GameError("BUSY_ACTIVITY","รอเรือกลับก่อนตกปลา");
      fishing.cast(p.playerId, this.fishingOwner(client), p.x, p.y, !!casinoAccess.roomFor(p.playerId), p.mapId as MapId);
      p.targetX = p.x; p.targetY = p.y;
    });
    fishEvent("fish:reel", (client, p, message) => {if(fishing.reel(p.playerId, this.fishingOwner(client), objectPayload(message).castId))world.recordFishing(p.playerId);});
    fishEvent("fish:cancel", (client, p) => { fishing.cancel(p.playerId, this.fishingOwner(client)); });
    this.onMessage("nature:sync", client => client.send("nature:weather", this.environment.weather(Date.now())));
    this.onMessage("world:sync", client => this.sendWorld(client));
    this.onMessage("world:action", async (client, message: unknown) => {
      const p = this.state.players.get(client.sessionId); if (!p) return;
      if(this.pendingActions.has(client.sessionId)){client.send("api:error",{event:"world:action",code:"SAVE_PENDING",message:"รอคำสั่งก่อนหน้ายืนยันก่อน"});return;}
      this.pendingActions.add(client.sessionId);
      try {
        const result = await storage.run(() => world.action({ id:p.playerId,name:p.name,map:p.mapId as MapId,x:p.x,y:p.y,inCasino:!!casinoAccess.roomFor(p.playerId) }, message, this.state.weather,this.environment.animals));
        p.cosmetic = world.profile(p.playerId).equipped;
        p.equipment = JSON.stringify(world.profile(p.playerId).equipment);
        if (result.activity) {
          if(fishing.cancel(p.playerId,this.fishingOwner(client)))this.sendFishing(client,p);
          p.activity=result.activity;
          if(result.activity==="camp") {const seat=[...this.state.players.values()].filter(other=>other.activity==="camp"&&other!==p).length%3;const chairs=[{x:840,y:450},{x:950,y:440},{x:800,y:400}];p.x=chairs[seat].x;p.y=chairs[seat].y;}
          p.targetX=p.x; p.targetY=p.y;
        }
        if (result.note !== undefined) for (const other of this.clients) if(this.state.players.get(other.sessionId)?.mapId===p.mapId) other.send("world:note",{id:client.sessionId,note:result.note});
        this.sendWorld(client, result.notice);
        this.sendFishing(client,p);
      } catch (error) { this.worldError(client,"world:action",error); }
      finally {this.pendingActions.delete(client.sessionId);}
    });
    this.onMessage("world:travel", async client => {
      const p=this.state.players.get(client.sessionId); if(!p)return;
      try { await storage.run(() => this.travel(client,p)); } catch(error) { this.worldError(client,"world:travel",error); }
    });
    this.onMessage("fish:clock", (client, message: unknown) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) return;
      const nonce = (message as { nonce?: unknown }).nonce;
      if (typeof nonce === "number" && Number.isSafeInteger(nonce)) client.send("fish:clock", { nonce, serverTime: Date.now() });
    });
    this.unsubscribeWallet = economy.subscribe((id, wallet) => {
      for (const client of this.clients) if ((client.auth as GuestIdentity)?.playerId === id) storage.deliver(() => client.send("wallet:update", wallet));
    });
    this.onMessage("auth:sync", client => {const ready=guests.ready(client.auth as GuestIdentity);storage.deliver(()=>client.send("auth:ready",ready));});
    this.onMessage("wallet:sync", client => {const wallet=economy.view((client.auth as GuestIdentity).playerId);storage.deliver(()=>client.send("wallet:update",wallet));});
    this.onMessage("casino:locate", client => client.send("casino:door", CASINO_DOOR));
    this.onMessage("casino:enter", client => this.enterCasino(client));

    // client -> server: เจตนาจะเดินไปที่จุดนี้
    this.onMessage("move", (client, msg: { x?: number; y?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg?.x !== "number" || typeof msg?.y !== "number") return;
      if (casinoAccess.roomFor(p.playerId) || p.activity === "boat") return;
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
      if (fishing.cancel(p.playerId, this.fishingOwner(client))) this.sendFishing(client, p);
      const t = clampToMap(msg.x, msg.y);
      p.targetX = t.x;
      p.targetY = t.y;
      p.activity = "";
    });

    this.onMessage("chat", (client, msg: { text?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const text = String(msg?.text ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, CHAT_MAX_LEN);
      if (!text) return;
      const now = Date.now();
      if (now - (this.lastChat.get(client.sessionId) ?? 0) < CHAT_COOLDOWN_MS) return;
      this.lastChat.set(client.sessionId, now);
      for(const other of this.clients) if(this.state.players.get(other.sessionId)?.mapId===p.mapId) other.send("chat", { id: client.sessionId, name: p.name, text });
    });

    this.onMessage("emote", (client, msg: { name?: string }) => {
      if (!this.state.players.has(client.sessionId)) return;
      const name = String(msg?.name ?? "");
      if (!EMOTES.has(name)) return;
      const p=this.state.players.get(client.sessionId)!;
      for(const other of this.clients) if(this.state.players.get(other.sessionId)?.mapId===p.mapId) other.send("emote", { id: client.sessionId, name });
    });

    // เซิร์ฟเวอร์เป็นคนขยับตัวละคร ด้วยความเร็วคงที่ กันโกง
    this.setSimulationInterval((dtMs) => {
      const now = Date.now();
      this.worldElapsed += dtMs;
      if (this.worldElapsed >= 1000 && !storage.busy) {
        this.worldElapsed = 0;
        void storage.run(() => world.tick()).then(() => { for(const client of this.clients){const p=this.state.players.get(client.sessionId);if(p){p.cosmetic=world.profile(p.playerId).equipped;p.equipment=JSON.stringify(world.profile(p.playerId).equipment);}this.sendWorld(client);} }).catch(() => {});
      }
      this.natureElapsed += dtMs;
      if (this.natureElapsed >= 100) {
        this.environment.update(now, this.natureElapsed); this.natureElapsed = 0;
        for (const [id, animal] of this.environment.animals) {
          const value = this.state.wildlife.get(id)!;
          value.x = animal.x; value.y = animal.y; value.facing = animal.facing; value.moving = animal.moving;
        }
      }
      const weather = this.environment.weather(now);
      this.state.weatherNextChangeAt = weather.nextChangeAt;
      if (this.state.weather !== weather.kind) {
        this.state.weather = weather.kind; this.broadcast("nature:weather", weather);
      }
      const dt = dtMs / 1000;
      this.state.players.forEach((p, id) => {
        const connection = this.clients.getById(id);
        if (connection && fishing.tick(p.playerId, this.fishingOwner(connection))) this.sendFishing(connection, p);
        const boat=world.boatFor(p.playerId);
        if(p.activity==="boat") {
          if(boat&&now>=boat.departAt) {const at=boatPosition(boat.departAt,now);const seat=boat.members.indexOf(p.playerId);p.x=at.x+(seat%2)*24-12;p.y=at.y+Math.floor(seat/2)*12;p.targetX=p.x;p.targetY=p.y;return;}
          if(!boat) {p.activity="";p.x=p.targetX=1080;p.y=p.targetY=570;}
        }
        const nearDoor = p.mapId === "town" && casinoAccess.isAtDoor(p.x, p.y);
        if (nearDoor && !this.atDoor.has(id)) {
          this.atDoor.add(id);
          const client = this.clients.getById(id);
          if (client) this.enterCasino(client);
        } else if (!nearDoor) this.atDoor.delete(id);
        if (casinoAccess.roomFor(p.playerId)) return;
        const waitingExit=exitDirection(p.x,p.y);
        if(waitingExit&&destination(p.mapId as MapId,waitingExit)&&!storage.busy&&connection) {
          void storage.run(()=>this.travel(connection,p)).catch(error=>this.worldError(connection,"world:travel",error));return;
        }
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;
        const step = Math.min(dist, SPEED * dt);
        const nx = p.x + (dx / dist) * step;
        const ny = p.y + (dy / dist) * step;
        // เดินชนสระน้ำ/น้ำพุ/ต้นไม้ไม่ได้ ลองไถลไปตามแกนใดแกนหนึ่งก่อน ถ้าไม่ได้ก็หยุด
        const blocked = (x:number,y:number) => p.mapId === "town" ? isBlocked(x,y) : worldBlocked(p.mapId as MapId,x,y);
        if (!blocked(nx, ny)) {
          p.x = nx;
          p.y = ny;
        } else if (!blocked(nx, p.y) && Math.abs(dx) > 1) {
          p.x = nx;
        } else if (!blocked(p.x, ny) && Math.abs(dy) > 1) {
          p.y = ny;
        } else {
          p.targetX = p.x;
          p.targetY = p.y;
        }
        if (Math.hypot(p.targetX - p.x, p.targetY - p.y) >= dist - 0.01) {
          // ไม่คืบหน้าเข้าหาเป้าหมายแล้ว (ติดสิ่งกีดขวาง) ให้หยุด
          p.targetX = p.x;
          p.targetY = p.y;
        }
        const direction=exitDirection(p.x,p.y);
        if(direction&&destination(p.mapId as MapId,direction)&&!storage.busy&&connection) {
          void storage.run(() => this.travel(connection,p)).catch(error=>this.worldError(connection,"world:travel",error));
        }
      });
    }, TICK_MS);
  }

  onJoin(client: Client, options: JoinOptions) {
    const identity = client.auth as GuestIdentity;
    const progress = world.connect(identity.playerId, cleanName(options?.name));
    const p = new Player();
    p.playerId = identity.playerId;
    p.name = cleanName(options?.name);
    p.mapId = progress.map; p.cosmetic = progress.equipped;
    p.equipment = JSON.stringify(progress.equipment);
    const appearance = options?.appearance;
    p.color = COLORS[optionIndex(appearance?.color, COLORS.length, Math.floor(Math.random() * COLORS.length))];
    p.hair = optionIndex(appearance?.hair, 6);
    p.skin = optionIndex(appearance?.skin, 3);
    p.pants = optionIndex(appearance?.pants, 3);
    p.style = optionIndex(appearance?.style, 3);
    p.gender = optionIndex(appearance?.gender, 2);
    const sp = spawnPoint();
    if(p.mapId!=="town") {sp.x=720;sp.y=p.mapId==="beach"?160:730;}
    if (casinoAccess.roomFor(identity.playerId)) {
      sp.x = CASINO_DOOR.x;
      sp.y = CASINO_DOOR.y;
      p.mapId = "town";
    }
    p.x = p.targetX = sp.x;
    p.y = p.targetY = sp.y;
    this.state.players.set(client.sessionId, p);
    storage.deliver(() => this.sendWorld(client));
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) fishing.cancel(p.playerId, this.fishingOwner(client));
    this.state.players.delete(client.sessionId);
    if(p&&![...this.state.players.values()].some(other=>other.playerId===p.playerId))world.disconnect(p.playerId);
    this.lastChat.delete(client.sessionId);
    this.atDoor.delete(client.sessionId);
  }

  onDispose() { this.unsubscribeWallet?.(); }

  private enterCasino(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    try {
      if(p.mapId!=="town") throw new GameError("WRONG_MAP","Boardgame อยู่ในเมืองกลาง");
      const entry = casinoAccess.enter(p.playerId, p.x, p.y);
      if (fishing.cancel(p.playerId, this.fishingOwner(client))) this.sendFishing(client, p);
      p.targetX = p.x;
      p.targetY = p.y;
      client.send("casino:entered", entry);
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      client.send("api:error", { event: "casino:enter", code: error.code, message: error.message });
    }
  }

  private fishingOwner(client: Client): string { return this.roomId + ":" + client.sessionId; }
  private sendFishing(client: Client, p: Player) {
    const owner = this.fishingOwner(client);
    const state = fishing.state(p.playerId, owner);
    p.fishing = fishing.publicPhase(p.playerId, owner);
    p.fishingBobberX = state.location?.bobberX ?? 0;
    p.fishingBobberY = state.location?.bobberY ?? 0;
    storage.deliver(() => client.send("fish:state", state));
  }
  private travel(client:Client,p:Player) {
    if(casinoAccess.roomFor(p.playerId)||p.activity==="boat") throw new GameError("BUSY_ACTIVITY","จบกิจกรรมก่อนเปลี่ยนแมพ");
    const direction=exitDirection(p.x,p.y), from=p.mapId as MapId;
    const next=direction&&destination(from,direction); if(!next)throw new GameError("NOT_AT_EXIT","เดินถึงป้ายทางออกก่อน");
    world.travel(p.playerId,next); fishing.cancel(p.playerId,this.fishingOwner(client));
    const spawn=arrival(next,from);p.mapId=next;p.x=p.targetX=spawn.x;p.y=p.targetY=spawn.y;p.activity="";p.fishing="";
    this.atDoor.delete(client.sessionId);storage.deliver(()=>{this.sendFishing(client,p);this.sendWorld(client,"ถึง"+next+"แล้ว");});
  }
  private sendWorld(client:Client,notice?:string) {
    const p=this.state.players.get(client.sessionId);if(!p||!mapId(p.mapId))return;
    const view=world.view(p.playerId,p.mapId);if(notice)view.notice=notice;
    storage.deliver(()=>client.send("world:state",view));
  }
  private worldError(client:Client,event:string,error:unknown) {
    client.send("api:error",{event,code:error instanceof GameError?error.code:"SAVE_UNAVAILABLE",message:error instanceof GameError?error.message:"บันทึกข้อมูลไม่ได้ กรุณารอแล้วลองใหม่"});
  }
}
