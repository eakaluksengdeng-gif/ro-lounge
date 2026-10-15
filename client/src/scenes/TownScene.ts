import Phaser from "phaser";
import { artImage } from '../reference/Assets';
import { groundCanvas } from '../reference/WorldArt';
import { TownNature } from "../nature/TownNature";
import { avatarMotion } from "../../../shared/avatarMotion";
import { gameSounds } from "../audio/GameSounds";
import { WorldRenderer } from "../world/WorldRenderer";
import { planRoute } from "../world/PathPlanner";
import { ensureCosmetics } from "../world/Cosmetics";
import { WORLD_NODES, type MapId, type WorldView } from "../../../shared/regions";
import {ProjectScenery} from '../world/ProjectScenery';
import { CATCHABLE_BUGS,wildlifeCatchKey,type WildlifeView } from '../../../shared/nature';
import { CASINO_BUILDING, CASINO_DOOR } from "../../../shared/casinoWorld";
import { HAIR_COLORS as HAIR, SKIN_COLORS as SKIN, PANTS_COLORS as PANTS } from "../character/appearance";
import type { Room } from "colyseus.js";
import type { ChatMsg, EmoteMsg, PlayerState } from "../net";
import {
  BENCHES, FOUNTAIN, LAMPS, MAP_H, MAP_W, PATH_COLS, PATH_ROWS, PLAZA, POND, PX, TILE, TILES_X, TILES_Y,
  TILE_PX, TREES, treeFeet,
} from "../world";
import {
  CHAR_H, CHAR_SCALE, CHAR_ORIGIN_Y, buildWorldTextures, ensureCharacter, hashString, mulberry32,
  type Dir, type Look,
} from "../art";

const FONT = '"Pixelify Sans", "Noto Sans Thai", system-ui, sans-serif';
const BUBBLE_MS = 5000;
const EMOTE_MS = 1800;
const EMOTE_ICONS: Record<string, string> = {
  happy: "😄", sad: "😢", love: "❤️", wave: "👋", angry: "💢", sleepy: "💤",
};


const HEAD_Y = -(CHAR_H + 2) * CHAR_SCALE - 4; // Sprite resolution does not change its world-space foot anchor.
const WALK_STEP_PX = 22; // ระยะเดินต่อ 1 ท่า
const WALK_SEQ = [1, 0, 2, 0];

interface Avatar {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  gear: Phaser.GameObjects.Image;
  look: Look;
  bubble: Phaser.GameObjects.Container;
  bubbleGfx: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  emote: Phaser.GameObjects.Text;
  bubbleTimer?: Phaser.Time.TimerEvent;
  emoteTimer?: Phaser.Time.TimerEvent;
  dir: Dir;
  flip: boolean;
  walk: number;
  texKey: string;
  lastActivity: string;
}

export class TownScene extends Phaser.Scene {
  /** Available before Phaser boots, because DOM activity UIs bind before Game creation. */
  readonly interactions=new Phaser.Events.EventEmitter();
  casinoOpen = false;
  worldOpen = false;
  onManualMove?: () => void;
  private avatars = new Map<string, Avatar>();
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private fountain?: Phaser.GameObjects.Image;
  private nature?: TownNature;
  private route: { x: number; y: number }[] = [];
  private map: MapId = "town";
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private worldRenderer?: WorldRenderer;
  private worldView?: WorldView;
  private projectScenery?:ProjectScenery;
  setWorldView(view:WorldView) {this.worldView=view;}
  wildlifeAvailable(id:string){return (this.worldView?.progress.cooldowns[wildlifeCatchKey(this.map,id)]??0)<=Date.now();}
  navigateTo(points: { x: number; y: number }[]) {
    const p=this.room.state?.players?.get(this.room.sessionId);if(!p)return;
    let cursor={x:p.x,y:p.y};this.route=[];
    for(const target of points){const leg=planRoute((p.mapId??"town") as MapId,cursor,target);if(!leg.length)break;this.route.push(...leg);cursor=leg[leg.length-1];}
    if (this.route[0]) this.room.send("move", this.route[0]);
  }
  navigateSafeTownTo(points:{x:number;y:number}[]) {
    this.navigateTo(points);
  }
  stopNavigation() { this.route = []; }

  constructor(private room: Room<any>, private onChat: (m: ChatMsg) => void) {
    super("town");
  }

  create() {
    buildWorldTextures(this);
    ensureCosmetics(this);
    this.cameras.main.setBackgroundColor("#1b2230");
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setRoundPixels(true);
    this.rebuildMap((this.room.state?.players?.get(this.room.sessionId)?.mapId??"town") as MapId);
    this.nature = new TownNature(this, this.room);

    // ภาพเคลื่อนไหวของน้ำและน้ำพุ
    let tick = 0;
    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
        tick++;
        for (const w of this.waterTiles) w.setTexture(`water${tick % 2}`);
        this.fountain?.setTexture(`fountain${tick % 2}`);
      },
    });

    // คลิกพื้นเพื่อเดิน
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // Phaser can receive document-level pointer events over HTML overlays.
      if (!(p.event?.target instanceof HTMLCanvasElement)) return;
      if (this.casinoOpen || this.worldOpen) return;
      const me=this.room.state.players.get(this.room.sessionId);
      let wildlifeId:string|undefined;
      this.room.state.wildlife.forEach((animal:WildlifeView,id:string)=>{if(me&&this.wildlifeAvailable(id)&&CATCHABLE_BUGS[animal.kind]&&Math.hypot(me.x-animal.x,me.y-animal.y)<=100&&Math.hypot(p.worldX-animal.x,p.worldY-(animal.y-16))<32)wildlifeId=id;});
      if(wildlifeId){this.interactions.emit('world:wildlife',wildlifeId);return;}
      const node=me&&WORLD_NODES.find(n=>n.map===me.mapId&&['bug','mushroom','rare','shell','treasure','cleanup','water'].includes(n.kind)&&Math.hypot(p.worldX-n.x,p.worldY-n.y)<42&&Math.hypot(me.x-n.x,me.y-n.y)<=100);
      if(node){this.interactions.emit('world:interact',node.id);return;}
      this.onManualMove?.();
      this.interactions.emit('world:manual-move');
      this.stopNavigation();
      const x = Math.round(p.worldX);
      const y = Math.round(p.worldY);
      this.navigateTo([{x,y}]);
      gameSounds.play("move");
      const ring = this.add.circle(x, y, 7, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.9).setDepth(MAP_H + 10);
      this.tweens.add({
        targets: ring, scale: 2.2, alpha: 0, duration: 380, onComplete: () => ring.destroy(),
      });
    });

    this.room.onMessage("chat", (m: ChatMsg) => {
      gameSounds.play("chat");
      this.showBubble(m.id, m.text);
      this.onChat(m);
    });
    this.room.onMessage("emote", (m: EmoteMsg) => { gameSounds.play("emote"); this.showEmote(m.id, m.name); });
  }

  /* ---------------- แมพ ---------------- */

  private rebuildMap(map:MapId) {
    this.projectScenery?.clear();this.projectScenery=new ProjectScenery(this);
    this.stopNavigation();this.map=map;
    for(const object of this.mapObjects)object.destroy();this.mapObjects=[];
    this.waterTiles=[];this.fountain=undefined;
    const before=new Set(this.children.list);
    if(map==="town") {this.buildMap();WorldRenderer.exits(this,map);this.worldRenderer=undefined;}
    else {this.worldRenderer=new WorldRenderer(this,map);this.worldRenderer.draw();}
    this.mapObjects=this.children.list.filter(object=>!before.has(object));
    for(const avatar of this.avatars.values())avatar.container.destroy();this.avatars.clear();
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)this.cameras.main.fadeIn(300,20,35,28);
    gameSounds.setBiome(map);
  }

  private buildMap() {
    const groundKey='reference-ground-town';
    if(!this.textures.exists(groundKey))this.textures.addCanvas(groundKey,groundCanvas('town'));
    this.add.image(0,0,groundKey).setOrigin(0).setDepth(-1000);
    const grassTiles:[number,number][]=[];
    for(let ty=0;ty<TILES_Y;ty++)for(let tx=0;tx<TILES_X;tx++){
      const pond=((tx+.5-POND.cx)/POND.rx)**2+((ty+.5-POND.cy)/POND.ry)**2;
      if(!PATH_ROWS.includes(ty)&&!PATH_COLS.includes(tx)&&pond>1.5&&!(tx>=PLAZA.x0&&tx<=PLAZA.x1&&ty>=PLAZA.y0&&ty<=PLAZA.y1))grassTiles.push([tx,ty]);
    }
    for(let x=55;x<MAP_W;x+=112)if(Math.abs(x-720)>130){this.add.image(x,54,'tree').setOrigin(.5,.94).setDepth(54);this.add.image(x,MAP_H+30,'tree').setOrigin(.5,.94).setDepth(MAP_H+30);}

    const shadowAt = (x: number, y: number, sx: number, sy: number) =>
      this.add.image(x, y, "shadow").setScale(sx, sy).setDepth(y - 1);

    // ต้นไม้
    for (const t of TREES) {
      const f = treeFeet(t);
      shadowAt(f.x, f.y - 2, 2.4, 1.6);
      this.add.image(f.x, f.y, "tree").setOrigin(0.5, 34 / 37).setScale(1).setDepth(f.y);
    }

    // พุ่มไม้ (ตำแหน่งสุ่มแต่คงที่ทุกเครื่อง)
    const bushRnd = mulberry32(21);
    let placed = 0;
    while (placed < 16 && grassTiles.length) {
      const [tx, ty] = grassTiles[Math.floor(bushRnd() * grassTiles.length)];
      const x = (tx + 0.5) * TILE_PX;
      const y = (ty + 0.9) * TILE_PX;
      if (TREES.some((t) => Math.hypot(treeFeet(t).x - x, treeFeet(t).y - y) < 60)) continue;
      shadowAt(x, y - 1, 1.1, 1);
      this.add.image(x, y, "bush").setOrigin(0.5, 12 / 14).setScale(1).setDepth(y);
      placed++;
    }

    // น้ำพุ
    this.buildCasino();
    for(const node of WORLD_NODES.filter(n=>n.map==='town')){
      this.add.image(node.x,node.y,'board').setDisplaySize(126,55).setDepth(node.y);
      this.add.text(node.x,node.y,({orders:'ออร์เดอร์',museum:'หอธรรมชาติ',home:'บ้าน / แต่งบ้าน',community:'ลานชุมชน'} as Record<string,string>)[node.kind]??node.name,{fontFamily:FONT,fontSize:'14px',color:'#fff3c5'}).setOrigin(.5).setDepth(node.y+1);
    }
    this.fountain = this.add.image(FOUNTAIN.x, FOUNTAIN.y, "fountain0").setScale(1).setDepth(FOUNTAIN.y + 40);

    // ม้านั่งและโคมไฟ
    for (const [bx, by] of BENCHES) {
      const x = bx * TILE_PX;
      const y = by * TILE_PX;
      shadowAt(x, y - 1, 1.7, 1);
      this.add.image(x, y, "bench").setOrigin(0.5, 11 / 14).setScale(1).setDepth(y);
    }
    for (const [lx, ly] of LAMPS) {
      const x = lx * TILE_PX;
      const y = ly * TILE_PX;
      this.add.image(x, y, "lamp").setOrigin(0.5, 23 / 26).setScale(1).setDepth(y);
      this.add.circle(x, y - 58, 40, 0xffe27a, 0.07).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 1);
    }

    // ป้ายชื่อเมือง
    const bx = FOUNTAIN.x;
    const by = (PLAZA.y0 - 0.4) * TILE_PX;
    this.add.image(bx, by, "board").setScale(1).setDepth(by);
    this.add.text(bx, by, "Town Square", { fontFamily: FONT, fontSize: "16px", color: "#fff4d6", fontStyle: "bold" })
      .setOrigin(0.5).setDepth(by + 1);
  }

  /* ---------------- ตัวละคร ---------------- */

  private buildCasino() {
    const {x,y,width:w,height:h}=CASINO_BUILDING;
    const key='reference-boardgame';
    if(!this.textures.exists(key))this.textures.addImage(key,artImage('prop-boardgame'));
    this.add.image(x+w/2,y+h,key).setOrigin(.5,.94).setDisplaySize(w+30,w+30).setDepth(y+h);
    this.add.text(x+w/2,y+61,'Boardgame',{fontFamily:FONT,fontSize:'16px',color:'#ffe6a5',backgroundColor:'#61412d',padding:{x:5,y:2}}).setOrigin(.5).setDepth(y+h+1);
    this.add.circle(CASINO_DOOR.x,CASINO_DOOR.y,22,0xffe27a,.12).setStrokeStyle(2,0xffe27a,.6).setDepth(-10);
    this.add.text(CASINO_DOOR.x,CASINO_DOOR.y+28,'Boardgame · เดินเข้าประตู',{fontFamily:FONT,fontSize:'12px',color:'#fff4d6',backgroundColor:'#244332cc',padding:{x:5,y:3}}).setOrigin(.5,0).setDepth(CASINO_DOOR.y+70);
  }
  update(_t: number, dtMs: number) {
    this.nature?.update(_t, dtMs);
    const me = this.room.state?.players?.get(this.room.sessionId);
    if(me&&(me.mapId??"town")!==this.map)this.rebuildMap(me.mapId);
    this.worldRenderer?.update(this.worldView,this.room.state?.weather??"sunny");
    this.projectScenery?.update(this.map,this.worldView);
    if (me) gameSounds.setNearWater(this.map==="beach"&&me.y>530 || this.map==="forest"&&Math.hypot(me.x-780,me.y-210)<260 || this.map==="town"&&(Math.hypot(me.x - FOUNTAIN.x, me.y - FOUNTAIN.y) < 130 ||
      Math.hypot(me.x - POND.cx * TILE_PX, me.y - POND.cy * TILE_PX) < 180));
    if (me && this.route[0] && Math.hypot(me.x - this.route[0].x, me.y - this.route[0].y) < 2) {
      this.route.shift();
      if (this.route[0]) this.room.send("move", this.route[0]);
    }
    const players = this.room.state?.players;
    if (!players) return;

    const seen = new Set<string>();
    players.forEach((p: PlayerState, id: string) => {
      if((p.mapId??"town")!==this.map)return;
      seen.add(id);
      let av = this.avatars.get(id);
      if (!av) {
        av = this.createAvatar(p, id);
        this.avatars.set(id, av);
        av.container.setPosition(p.x, p.y);
        if (id === this.room.sessionId) this.cameras.main.startFollow(av.container, true, 0.12, 0.12);
      }
      this.moveAvatar(av, p, dtMs, id === this.room.sessionId);
    });

    for (const [id, av] of this.avatars) {
      if (!seen.has(id)) {
        av.container.destroy();
        this.avatars.delete(id);
      }
    }
  }

  private moveAvatar(av: Avatar, p: PlayerState, dtMs: number, own: boolean) {
    const c = av.container;
    const motion = avatarMotion(c, p, dtMs);
    const { x: nx, y: ny, dx, dy, distance: dist } = motion;
    // Preserve subpixels for convergence. Rounding here left a permanent residual,
    // which repeatedly triggered walking/facing changes on an otherwise idle avatar.
    c.setPosition(nx, ny);
    c.setDepth(c.y);
    const fishing=!!p.fishing;
    const cosmetic=fishing&&(!p.cosmetic||p.cosmetic==='none')?'straw-hat':p.cosmetic||'none';
    av.gear.setTexture("gear-"+cosmetic);
    av.gear.setFlipX(av.dir==="side"&&av.flip);
    av.sprite.setAlpha(p.activity==="camp"?.9:1);
    av.sprite.y = av.gear.y = p.activity === "camp" ? 6 : 0;
    if(p.activity!==av.lastActivity){
      if(p.activity==="feed") {av.emote.setText("♥").setColor("#f3a6a5").setVisible(true);av.emoteTimer?.remove();av.emoteTimer=this.time.delayedCall(1700,()=>av.emote.setVisible(false));}
      av.lastActivity=p.activity;
    }

    let frame = 0;
    if (motion.walking) {
      if (Math.abs(dx) > Math.abs(dy)) {
        av.dir = "side";
        av.flip = dx < 0;
      } else {
        av.dir = dy < 0 ? "up" : "down";
      }
      const previousStep = Math.floor(av.walk / WALK_STEP_PX);
      av.walk += dist;
      if (own && !this.casinoOpen && Math.floor(av.walk / WALK_STEP_PX) !== previousStep) gameSounds.play("footstep");
      frame = WALK_SEQ[Math.floor(av.walk / WALK_STEP_PX) % WALK_SEQ.length];
    }
    if(fishing){const vx=p.fishingBobberX-p.x,vy=p.fishingBobberY-p.y;if(Math.abs(vx)>Math.abs(vy)){av.dir='side';av.flip=vx<0;}else{av.dir=vy<0?'up':'down';av.flip=false;}av.gear.setFlipX(av.dir==='side'&&av.flip);}
    const pose=fishing?'fishing':p.activity==='camp'?'seated':undefined;
    const key = pose?`ch-${av.look.id}-${pose}-${av.dir}-0`:`ch-${av.look.id}-${av.dir}-${frame}`;
    if (key !== av.texKey) {
      av.sprite.setTexture(key);
      av.texKey = key;
    }
    av.sprite.setFlipX(av.dir === "side" && av.flip);
  }

  private lookFor(p: PlayerState, id: string): Look {
    // ค่า fallback ทำให้ client ใหม่ยังใช้กับ server เวอร์ชันก่อนมีตัวเลือกหน้าตาได้ระหว่าง deploy
    const h = hashString(id + p.name);
    const index = (value: number, count: number, fallback: number) =>
      Number.isInteger(value) ? Math.max(0, Math.min(count - 1, value)) : fallback;
    const hair = index(p.hair, HAIR.length, h % HAIR.length);
    const skin = index(p.skin, SKIN.length, (h >>> 3) % SKIN.length);
    const pants = index(p.pants, PANTS.length, (h >>> 5) % PANTS.length);
    const style = index(p.style, 3, (h >>> 7) % 3);
    const gender = index(p.gender, 2, 0);
    return {
      id: `${p.color}-${hair}-${skin}-${pants}-${style}-${gender}`,
      shirt: "#" + p.color.toString(16).padStart(6, "0"),
      hair: HAIR[hair],
      skin: SKIN[skin],
      pants: PANTS[pants],
      style,
      gender,
    };
  }

  private createAvatar(p: PlayerState, id: string): Avatar {
    const look = this.lookFor(p, id);
    ensureCharacter(this, look);
    const isMe = id === this.room.sessionId;

    const shadow = this.add.image(0, -1, "shadow").setScale(1.1, 1);
    const texKey = `ch-${look.id}-down-0`;
    const sprite = this.add.sprite(0, 0, texKey).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(CHAR_SCALE);
    const gear = this.add.image(0,0,"gear-"+(p.cosmetic||"none")).setOrigin(.5,CHAR_ORIGIN_Y).setScale(CHAR_SCALE);

    const name = this.add.text(0, 6, p.name, {
      fontFamily: FONT, fontSize: "14px", color: isMe ? "#ffe27a" : "#ffffff",
      backgroundColor: "rgba(20,24,36,0.62)", padding: { x: 5, y: 1 },
    }).setOrigin(0.5, 0);

    const bubbleGfx = this.add.graphics();
    const bubbleText = this.add.text(0, 0, "", {
      fontFamily: FONT, fontSize: "15px", color: "#2b2233", align: "center", wordWrap: { width: 170 },
    }).setOrigin(0.5, 0);
    const bubble = this.add.container(0, HEAD_Y, [bubbleGfx, bubbleText]).setVisible(false);

    const emote = this.add.text(0, HEAD_Y, "", { fontSize: "30px" }).setOrigin(0.5, 1).setVisible(false);

    const container = this.add.container(0, 0, [shadow, sprite, gear, name, bubble, emote]);
    return {
      container, sprite, gear, look, bubble, bubbleGfx, bubbleText, emote,
      dir: "down", flip: false, walk: 0, texKey, lastActivity:"",
    };
  }

  private showBubble(id: string, text: string) {
    const av = this.avatars.get(id);
    if (!av) return;
    av.emote.setVisible(false);
    const t = av.bubbleText.setText(text);
    const w = Math.max(24, t.width) + 14;
    const h = t.height + 10;
    const tail = 6;
    const top = -tail - h;
    t.setPosition(0, top + 5);

    const g = av.bubbleGfx;
    g.clear();
    g.fillStyle(0x2b2233, 1);
    g.fillRect(-w / 2 - 2, top - 2, w + 4, h + 4);
    g.fillTriangle(-6, -tail + 1, 6, -tail + 1, 0, 1);
    g.fillStyle(0xffffff, 1);
    g.fillRect(-w / 2, top, w, h);
    g.fillTriangle(-4, -tail, 4, -tail, 0, -1);

    av.bubble.setVisible(true);
    av.bubbleTimer?.remove();
    av.bubbleTimer = this.time.delayedCall(BUBBLE_MS, () => av.bubble.setVisible(false));
  }

  private showEmote(id: string, name: string) {
    const av = this.avatars.get(id);
    const icon = EMOTE_ICONS[name];
    if (!av || !icon) return;
    av.bubble.setVisible(false);
    av.emote.setText(icon).setVisible(true).setScale(0.3);
    this.tweens.add({ targets: av.emote, scale: 1, duration: 220, ease: "Back.Out" });
    av.emoteTimer?.remove();
    av.emoteTimer = this.time.delayedCall(EMOTE_MS, () => av.emote.setVisible(false));
  }
}
