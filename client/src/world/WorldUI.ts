import type { Room } from "colyseus.js";
import type { TownScene } from "../scenes/TownScene";
import { MAP_NAMES, WORLD_NODES, MAP_IDS, ITEMS, COSMETICS, SEEDS, destination,worldBlocked, type MapId, type WorldView, type WorldNode, type Direction } from "../../../shared/regions";
import { FISH_SPECIES,CATCHABLE_BUGS,wildlifeCatchKey,type WildlifeView,type FishingState } from "../../../shared/nature";
import { gameSounds } from "../audio/GameSounds";
import { cosmeticCanvas, itemCanvas } from "./Cosmetics";
import { appearanceToLook, loadAppearance, playerToLook } from "../character/appearance";
import { renderCharacterCanvas, type CharacterPose } from "../art";
import "./world.css";
import { groundCanvas } from '../reference/WorldArt';
import { bagCanvas } from './bag';
import {catalogue,bagEntries,bagQuantity} from './inventory';
import {VILLAGE_ORDERS,SKILL_NAMES,villageLevel} from '../../../shared/village';
import {CozyUI} from './CozyUI';
import {RECIPES,FURNITURE} from '../../../shared/cozy';
import {SEASON_GEAR} from '../../../shared/equipment';
import {DirectFarmUI} from './DirectFarmUI';
import {WardrobeUI} from './WardrobeUI';
import {NEW_GEAR} from '../../../shared/equipment';
import {equipmentCanvas,wireEquipment} from './EquipmentArt';
import {GAME_NAME} from '../brand';
const STATIONS=["รับออร์เดอร์","เตรียม","ปรุง","เสิร์ฟ"];
const COLLECTION_HINTS:Record<string,string>={
  butterfly:"ป่าน้ำตก · ผีเสื้อฟ้าตามทาง",beetle:"ป่าน้ำตก · ด้วงทองฝั่งตะวันออก",firefly:"ป่าน้ำตก · ตอนเย็นหรือกลางคืน",
  mushroom:"ป่าน้ำตก · ใต้ต้นไม้", "snow-rabbit":"ป่าน้ำตก · เมื่อหิมะตก", "animal-friend":"ฟาร์ม · ให้อาหารแมวและกระต่าย",
  carrot:"ฟาร์ม · ปลูก รดน้ำ และเก็บเกี่ยว",tomato:"ฟาร์ม · ปลูก รดน้ำ และเก็บเกี่ยว",wheat:"ฟาร์ม · ปลูก รดน้ำ และเก็บเกี่ยว",
  shell:"หาดสายลม · ตามริมทราย",pearl:"หาดสายลม · เปลือกหอยกลางหาด",treasure:"หาดสายลม · หีบเก่าฝั่งตะวันตก",
  cleanup:"หาดสายลม · ช่วยเก็บขยะ",voyager:"หาดสายลม · ล่องเรือกลับถึงท่า",camper:"ป่าน้ำตก · นั่งข้างกองไฟ",
  chef:"ตลาดโคมไฟ · ช่วยทีมเสิร์ฟอาหารครบ 3 จาน",musician:"ตลาดโคมไฟ · เล่นเวทีดนตรี",
  'garden-salad':'คาเฟ่ · ปรุงจากแครอทและมะเขือเทศ',
  'forest-soup':'คาเฟ่ · ปรุงจากเห็ดและแครอท',
  'fish-soup':'คาเฟ่ · ปรุงจากปลาคาร์ปและแครอท',
  'picnic-bread':'คาเฟ่ · ปรุงจากข้าวสาลี 2 ชิ้น',
};
export class WorldUI {
  private view?:WorldView;
  private fish:Record<string,number>={};
  private panel=document.createElement("section");
  private body=document.createElement("div");
  private title=document.createElement("h2");
  private notice=document.createElement("p");
  private toolbar=document.createElement("div");
  private mapLabel=document.createElement("strong");
  private minimap=document.createElement("canvas");
  private interact=document.createElement("button");
  private page="map";
  private category='ทั้งหมด';
  private grounds=new Map<MapId,HTMLCanvasElement>();
  private node?:WorldNode;
  private recipe="salad";
  private signature="";
  private pending=false;
  private pendingVerb="";
  private pendingTimer?:number;
  private previousMap:MapId="town";
  private toast=document.createElement('div');
  private toastTimer?:number;
  private controller=new AbortController();
  private selectedItem='';
  private bagCount=document.createElement('span');
  private inventoryCategory='ทั้งหมด';
  private inventoryQuery='';
  private inventorySort='name';
  private journalFilter='all';
  private fishDiscoveries:string[]=[];
  private villageConfirmation?:{verb:'order-submit'|'museum-donate';id:string};
  private cozyUI=new CozyUI();
  private farm:DirectFarmUI;
  private wardrobe=new WardrobeUI();
  constructor(private room:Room,private scene:TownScene) {
    this.farm=new DirectFarmUI(scene,(verb,payload)=>this.send(verb,payload));
    this.toolbar.id="worldToolbar";this.minimap.width=120;this.minimap.height=72;this.minimap.setAttribute("aria-label","แผนที่ย่อและตำแหน่งของคุณ");
    const bag=this.button('กระเป๋า',()=>this.open('inventory'));bag.id='worldBagButton';bag.setAttribute('aria-label','กระเป๋า');bag.title='กระเป๋า · B';this.bagCount.className='bag-count';this.bagCount.setAttribute('aria-hidden','true');bag.prepend(bagCanvas());bag.append(this.bagCount);
    const nearby=this.button('กิจกรรม',()=>this.open('nearby'));nearby.id='nearbyActivitiesButton';nearby.setAttribute('aria-label','กิจกรรมใกล้ตัว');
    this.toolbar.append(this.mapLabel,this.minimap,this.button("🧭 แผนที่",()=>this.open("map")),this.button("สมุดสะสม",()=>this.open("collection")),nearby,bag);
    this.toolbar.setAttribute('aria-busy','true');this.toolbar.querySelectorAll('button').forEach(button=>button.disabled=true);
    document.body.append(this.toolbar);
    this.interact.id="worldInteract";this.interact.type="button";this.interact.hidden=true;
    this.interact.addEventListener("click",()=>this.activate());document.body.append(this.interact);
    this.toast.id='worldToast';this.toast.hidden=true;this.toast.setAttribute('role','status');document.body.append(this.toast);
    this.panel.id="worldPanel";this.panel.hidden=true;this.panel.setAttribute("role","dialog");this.panel.setAttribute("aria-modal","true");this.panel.setAttribute("aria-label","สำรวจโลกและกิจกรรม");
    const frame=document.createElement("div");frame.className="world-frame";
    const header=document.createElement("header");header.append(this.title,this.button("ปิด",()=>this.close()));
    this.notice.id="worldNotice";this.notice.setAttribute("role","status");frame.append(header,this.notice,this.body);this.panel.append(frame);document.body.append(this.panel);
    this.room.onMessage<WorldView>("world:state",view=>{
      if(!this.view){this.toolbar.setAttribute('aria-busy','false');this.toolbar.querySelectorAll('button').forEach(button=>button.disabled=false);}
      this.view=view;this.scene.setWorldView(view);this.mapLabel.textContent=MAP_NAMES[view.map];
      if(view.map!==this.previousMap){this.close();this.previousMap=view.map;gameSounds.play("join");}
      if(view.notice){this.notice.textContent=view.notice;this.pending=false;window.clearTimeout(this.pendingTimer);
        this.showToast(view.notice);
        if(this.pendingVerb!=="note")gameSounds.play(this.pendingVerb==="exchange"?"win":['collect','catch'].includes(this.pendingVerb)?"catch":"select");
        if(this.pendingVerb==="boat"||this.pendingVerb==="sit")this.close();this.pendingVerb="";this.render(true);}
      else this.render();
    });
    this.room.onMessage<FishingState>("fish:state",state=>{this.fish={...state.inventory} as Record<string,number>;this.fishDiscoveries=state.discovered??[];this.render();});
    this.room.onMessage("world:note",(event:{note:number})=>gameSounds.playNote(event.note));
    this.room.onMessage("api:error",(error:{event:string;message:string})=>{
      if(!error.event.startsWith("world:"))return;this.pending=false;window.clearTimeout(this.pendingTimer);
      this.notice.textContent=error.message;gameSounds.play("error");this.render(true);
      this.showToast(error.message);
    });
    document.addEventListener("keydown",event=>{
      if(event.code==='KeyB'&&!event.repeat&&!(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')){event.preventDefault();if(!this.panel.hidden&&this.page==='inventory')this.close();else this.open('inventory');return;}
      if(event.key==="Escape"&&!this.panel.hidden){event.preventDefault();this.close();return;}
      if(event.code!=="KeyE"||event.repeat||this.scene.casinoOpen||!this.panel.hidden)return;
      if((event.target as HTMLElement)?.closest("input,textarea,select,button,[contenteditable]"))return;
      if(this.farm.primary()){event.preventDefault();return;}
      if(this.node){event.preventDefault();this.activate();}
    },{signal:this.controller.signal});
    const timer=window.setInterval(()=>this.update(),200);
    this.room.onLeave(()=>{this.farm.destroy();this.controller.abort();window.clearInterval(timer);window.clearTimeout(this.pendingTimer);window.clearTimeout(this.toastTimer);this.toast.remove();this.close();this.toolbar.remove();this.interact.remove();this.panel.remove();});
    this.room.send("world:sync",{});
    const direct=(id:string)=>{const node=WORLD_NODES.find(n=>n.id===id);const p=this.player();if(node&&p&&node.map===p.mapId&&Math.hypot(p.x-node.x,p.y-node.y)<=100){this.node=node;this.activate();}};
    this.scene.interactions?.on('world:interact',direct);
    this.room.onLeave(()=>this.scene.interactions?.off('world:interact',direct));
    const wild=(id:string)=>{const node=this.wildlifeNode(id),p=this.player();if(node&&p&&Math.hypot(p.x-node.x,p.y-node.y)<=100){this.node=node;this.activate();}};
    this.scene.interactions?.on('world:wildlife',wild);this.room.onLeave(()=>this.scene.interactions?.off('world:wildlife',wild));
    const plot=(slot:number)=>{this.farm.select(slot);this.update();};this.scene.interactions?.on('world:plot',plot);this.room.onLeave(()=>this.scene.interactions?.off('world:plot',plot));
  }
  private button(label:string,run:()=>void,disabled=false) {
    const b=document.createElement("button");b.type="button";b.textContent=label;b.disabled=disabled;b.addEventListener("click",run);return b;
  }
  private text(text:string,className="") {const p=document.createElement("p");p.textContent=text;p.className=className;return p;}
  private player(){return this.room.state?.players?.get(this.room.sessionId);}
  private showToast(message:string){
    this.toast.replaceChildren();if(['collect','catch'].includes(this.pendingVerb)&&this.node?.item)this.toast.append(itemCanvas(this.node.item));
    this.toast.append(document.createTextNode(message));this.toast.hidden=false;
    window.clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>this.toast.hidden=true,2600);
  }
  private activate(){
    if(!this.node||this.scene.casinoOpen)return;
    if(this.node.kind==='farm'||this.node.kind==='greenhouse'){this.farm.primary();return;}
    if(this.node.id.startsWith('wildlife:')){this.send('catch',{wildlifeId:this.node.id.split(':')[2]});return;}
    if(['bug','mushroom','rare','shell','treasure','cleanup','animal','water'].includes(this.node.kind)){
      this.send(this.node.kind==='water'?'refill':this.node.kind==='animal'?'feed':'collect');
    }else this.open(this.node.kind);
  }
  private send(verb:string,payload:Record<string,unknown>={}) {
    if(this.pending)return;this.pending=true;this.pendingVerb=verb;this.scene.stopNavigation();
    this.notice.textContent="กำลังยืนยันและบันทึก…";
    this.room.send("world:action",{requestId:crypto.randomUUID(),verb,nodeId:this.node?.id,...payload});
    this.pendingTimer=window.setTimeout(()=>{this.pending=false;this.notice.textContent="ยังไม่ได้รับการยืนยัน กรุณารอแล้วลองใหม่";this.render(true);},12000);
    this.render(true);
  }
  private open(page:string) {if(!this.view||this.scene.casinoOpen||page==='farm'||page==='greenhouse')return;this.page=page;this.panel.hidden=false;this.scene.worldOpen=true;document.body.classList.add("world-ui-open");this.notice.textContent="";this.render(true);}
  private close(){this.cozyUI.reset();this.villageConfirmation=undefined;this.panel.hidden=true;this.scene.worldOpen=false;document.body.classList.remove("world-ui-open");}
  private update() {
    const p=this.player();if(!p)return;
    if(this.scene.casinoOpen&&!this.panel.hidden)this.close();
    this.toolbar.hidden=this.scene.casinoOpen;
    const nearby=WORLD_NODES.filter(n=>n.map===(p.mapId??'town'));
    this.room.state?.wildlife?.forEach((_animal:WildlifeView,id:string)=>{const node=this.wildlifeNode(id);if(node&&(this.view?.progress.cooldowns[node.id]??0)<=Date.now())nearby.push(node);});
    if(this.panel.hidden)this.node=nearby.filter(n=>Math.hypot(p.x-n.x,p.y-n.y)<=100).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
    this.bagCount.textContent=String(this.view?bagQuantity(this.view.progress,this.fish):0);
    this.farm.update(this.view,p,this.scene.casinoOpen||!this.panel.hidden||p.activity==='boat',this.pending);
    this.interact.hidden=!this.node||this.scene.casinoOpen||!this.panel.hidden||p.activity==="boat"||this.node.kind==='farm'||this.node.kind==='greenhouse';
    this.interact.textContent=this.node?this.node.name+" · E / แตะ":"";
    const cooldown=this.view?.progress.cooldowns[this.node?.kind==='water'?'refill':this.node?.kind==='animal'?'feed':this.node?.id??'']??0;
    this.interact.disabled=this.pending||cooldown>Date.now();
    if(cooldown>Date.now())this.interact.textContent='กลับมาใน '+Math.ceil((cooldown-Date.now())/1000)+' วิ';
    if(this.node&&this.scene.cameras){const camera=this.scene.cameras.main;
      const canvas=this.scene.game.canvas.getBoundingClientRect();
      this.interact.style.left=Math.max(90,Math.min(innerWidth-90,canvas.left+(this.node.x-camera.scrollX)*camera.zoom*canvas.width/this.scene.scale.width))+'px';
      this.interact.style.top=Math.max(70,Math.min(innerHeight-70,canvas.top+(this.node.y-camera.scrollY-65)*camera.zoom*canvas.height/this.scene.scale.height))+'px';
      this.interact.style.bottom='auto';}
    this.drawMinimap();this.render();
    this.body.querySelectorAll<HTMLElement>("[data-ready-at]").forEach(el=>{
      const remaining=Math.max(0,Math.ceil((Number(el.dataset.readyAt)-Date.now())/1000));
      el.textContent=remaining?remaining+" วินาที":"โตแล้ว";
    });
  }
  private wildlifeNode(id:string):WorldNode|undefined {
    const animal=this.room.state?.wildlife?.get(id) as WildlifeView|undefined,p=this.player();
    const bug=animal&&CATCHABLE_BUGS[animal.kind];if(!animal||!bug||!p)return;
    const map=(p.mapId??'town') as MapId;
    if(map!=='town'&&worldBlocked(map,animal.x,animal.y))return;
    return {id:wildlifeCatchKey(map,id),map,x:animal.x,y:animal.y,kind:'bug',name:bug.name,item:bug.item};
  }
  private render(force=false) {
    if(this.panel.hidden||!this.view)return;
    const sig=JSON.stringify([this.page,this.page==='nearby'?this.nearbySignature():null,this.view.progress,this.view.farms,this.view.cafe,this.view.boat,this.view.cleanup,this.view.community,this.view.homes,this.fish,this.fishDiscoveries,this.pending,this.node?.id,
      this.view.community?.picnic?Date.now()>=this.view.community.picnic.endsAt:false,
      this.view.community?.picnic?Date.now()>this.view.community.picnic.endsAt+60000:false,
      Date.now()>=(this.view.progress.cooldowns.cook??0),Date.now()>=(this.view.progress.cooldowns.picnic??0),
      this.view.farms.flatMap(farm=>farm.plots.map(crop=>crop?Date.now()>=crop.readyAt:false)),
      Date.now()>=(this.view.progress.cooldowns[this.node?.id??""]??0)]);
    if(!force&&sig===this.signature)return;this.signature=sig;this.body.replaceChildren();
    this.panel.dataset.page=this.page;
    if(this.page==="map"){this.title.textContent='โลกของ '+GAME_NAME;this.mapPage();return;}
    if(this.page==='nearby'){this.title.textContent='กิจกรรมใกล้ตัว';this.nearbyPage();return;}
    if(this.page==='inventory'){this.title.textContent='กระเป๋าของฉัน';this.inventoryPage();return;}
    if(this.page==='collection'){this.title.textContent='สมุดสะสม';this.collectionPage();return;}
    if(!this.node){this.body.append(this.text("กลับไปใกล้จุดกิจกรรมเพื่อใช้งาน"));return;}
    this.title.textContent=this.node.name;
    if(this.page==='cooking'){this.title.textContent='ครัวส่วนตัว · ปรุงอาหาร';this.body.append(this.button('กลับไปครัวทีม',()=>this.open('cafe')));}
    if(['home','community','cooking'].includes(this.page)){this.cozyUI.render(this.page,this.view,this.fish,this.body,this.player()?.playerId,this.pending,(verb,payload)=>this.send(verb,payload),()=>this.render(true),id=>{let player:any;this.room.state?.players?.forEach((p:any)=>{if(p.playerId===id)player=p;});if(!player||typeof player.color!=='number')return;const person=document.createElement('div'),avatar=renderCharacterCanvas(playerToLook(player),'down',0,'seated');avatar.getContext('2d')!.drawImage(equipmentCanvas(wireEquipment(player),'down','seated'),0,0);person.append(avatar,this.text(player.name??'เพื่อน'));return person;});return;}
    if(this.page==='orders'||this.page==='museum'){this.villagePage();return;}
    if(this.page==="cafe"){this.cafePage();return;}
    if(this.page==="shop"){this.shopPage();return;}
    if(this.page==="stage"){
      this.body.append(this.text("เล่นเปียโนให้คนในตลาดฟัง · เพลงเกมยังปรับปิดแยกได้"));
      const row=document.createElement("div");row.className="world-actions";
      ["โด","เร","มี","ฟา","ซอล","ลา","ที","โดสูง"].forEach((note,index)=>row.append(this.button(note,()=>this.send("note",{note:index}),this.pending)));this.body.append(row);return;
    }
    const verb=this.page==="camp"?"sit":this.page==="animal"?"feed":this.page==="boat"?"boat":"collect";
    const cooldown=this.view.progress.cooldowns[this.node.id]??0;
    if(cooldown>Date.now())this.body.append(this.text("จุดนี้กำลังฟื้นตัว อีก "+Math.ceil((cooldown-Date.now())/1000)+" วินาที"));
    if(this.page==="cleanup")this.body.append(this.text("ทั้งชุมชนช่วยเก็บแล้ว "+this.view.cleanup+" ชิ้น"));
    if(this.page==="boat")this.body.append(this.text(this.view.boat?"เรือมี "+this.view.boat.members.length+"/4 คน · รอเรือกลับหากออกแล้ว":"ขึ้นพร้อมเพื่อนได้ 1–4 คน · เดินทาง 20 วินาทีแล้วกลับท่า"));
    if(this.page==="rare")this.body.append(this.text("บันทึกสัตว์หายากเมื่อหิมะตก ไม่จับสัตว์ใส่กระเป๋า"));
    if(this.node.id==="bug-firefly")this.body.append(this.text("หิ่งห้อยออกตอนเย็นและกลางคืน"));
    this.body.append(this.button(this.page==="camp"?"นั่งข้างกองไฟ":this.page==="animal"?"ให้อาหาร":this.page==="boat"?"ขึ้นเรือ":this.node.name,()=>this.send(verb),this.pending||cooldown>Date.now()));
    this.body.append(this.text("รางวัลเป็นของสะสมและการปลดล็อก ไม่หักหรือเพิ่มชิปเอง"));
  }
  private mapPage(){
    this.body.append(this.text("คลิกพื้นเพื่อเดิน · เดินถึงป้ายขอบแมพเพื่อไปโซนถัดไป · ทุกแมพใช้กระเป๋าเดียวกัน"));
    const grid=document.createElement("div");grid.className="world-map-grid";
    for(const map of MAP_IDS){
      const card=document.createElement("article");card.dataset.map=map;card.append(this.text(MAP_NAMES[map],"world-card-title"));
      const activities={town:"Boardgame · บ่อปลา · ออร์เดอร์ · หอสะสม",forest:"แมลง · เห็ด · กระต่ายหิมะ · แคมป์",farm:"ปลูกผัก · โรงเรือน · รดน้ำเพื่อน · สัตว์",beach:"ปลาทะเล · หอย · สมบัติ · เก็บขยะ · เรือ",market:"ครัว 2–4 คน · ร้านชุด · เวทีดนตรี"};
      card.append(this.text(activities[map]));grid.append(card);
    }
    this.body.append(grid);
    const p=this.player(),map=(p?.mapId??"town") as MapId;
    const actions=document.createElement("div");actions.className="world-actions";
    for(const direction of ["north","west","east","south"] as Direction[]){
      const next=destination(map,direction);if(!next)continue;
      actions.append(this.button(({north:"↑",south:"↓",west:"←",east:"→"} as const)[direction]+" เดินไป"+MAP_NAMES[next],()=>this.navigateExit(direction),p?.activity==="boat"));
    }
    this.body.append(actions);
    if(map==='town'){
      const village=document.createElement('div');village.className='world-actions';
      for(const id of ['village-board','nature-museum','cozy-home','cozy-community']){const node=WORLD_NODES.find(n=>n.id===id)!;village.append(this.button('เดินไป'+node.name,()=>{this.close();this.scene.navigateTo([{x:node.x,y:node.y}]);},p?.activity==='boat'));}this.body.append(village);
    }
  }
  private nearbySignature(){const p=this.player();return WORLD_NODES.filter(n=>n.map===(p?.mapId??'town')).map(n=>[n.id,!!p&&Math.hypot(p.x-n.x,p.y-n.y)<=100,(this.view?.progress.cooldowns[n.id]??0)>Date.now()]);}
  private nearbyPage(){
    const p=this.player();if(!p)return;this.body.append(this.text('เลือกสิ่งที่อยากทำ · เดินเข้าใกล้แล้วกด E หรือแตะ · ไม่มีเมนูบังคับรับงาน'));
    const icons:Record<string,string>={home:'camper',community:'cleanup',orders:'cafe-order',museum:'butterfly',water:'carp',bug:'butterfly',mushroom:'mushroom',rare:'snow-rabbit',camp:'camper',farm:'carrot',greenhouse:'tomato',animal:'animal-friend',shell:'shell',treasure:'treasure',cleanup:'cleanup',boat:'voyager',cafe:'chef',shop:'straw-hat',stage:'musician'};
    const hints:Record<string,string>={home:'แต่งบ้านและสร้างของจากวัตถุดิบ',community:'ช่วยสร้างเมือง ปิกนิก และเทศกาล',orders:'ส่งผลผลิต รับ XP และเครื่องแต่งกาย',museum:'มอบตัวอย่างเพื่อสะสมชนิดถาวร',water:'ตักน้ำไว้รดผักของคุณ',farm:'ปลูก รดน้ำ และเก็บเกี่ยวตรงแปลง',greenhouse:'ดูแลพืชในโรงเรือน',cafe:'ทำครัวกับเพื่อนหรือปรุงจากของในกระเป๋า',shop:'แลกเครื่องแต่งกายด้วยผลผลิต'};
    const grid=document.createElement('div');grid.className='nearby-activities';
    for(const node of WORLD_NODES.filter(n=>n.map===(p.mapId??'town')).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))){
      const close=Math.hypot(p.x-node.x,p.y-node.y)<=100,card=document.createElement('article');card.dataset.activity=node.id;
      const icon=itemCanvas(icons[node.kind]??'cleanup'),info=document.createElement('div');info.append(this.text(node.name,'world-card-title'),this.text(hints[node.kind]??'กิจกรรมเล็ก ๆ ระหว่างสำรวจหมู่บ้าน','activity-hint'));
      const cooldown=this.view!.progress.cooldowns[node.id]??0,ready=close&&cooldown<=Date.now()&&!['farm','greenhouse'].includes(node.kind);
      const action=this.button(ready?'ทำกิจกรรม':cooldown>Date.now()?'จุดนี้กำลังพัก':'เดินไปหา',()=>{if(ready){this.node=node;this.activate();}else{this.close();this.scene.navigateTo([{x:node.x,y:node.y}]);}},this.pending||cooldown>Date.now()||p.activity==='boat');action.dataset.nearbyAction=node.id;
      card.append(icon,info,action);grid.append(card);
    }this.body.append(grid);
  }
  private navigateExit(direction:Direction) {
    const p=this.player();if(!p)return;this.close();
    const map=p.mapId??"town";
    const paths:Record<Direction,{x:number;y:number}[]>=map==="town"?{
      north:[{x:p.x,y:576},{x:650,y:576},{x:650,y:160},{x:720,y:90}],
      south:[{x:p.x,y:576},{x:720,y:800}],
      west:[{x:p.x,y:576},{x:600,y:576},{x:600,y:432},{x:24,y:432}],
      east:[{x:p.x,y:576},{x:1280,y:576},{x:1280,y:432},{x:1408,y:432}],
    }:{north:[{x:p.x,y:432},{x:720,y:432},{x:720,y:90}],south:[{x:p.x,y:432},{x:720,y:432},{x:720,y:800}],west:[{x:p.x,y:432},{x:24,y:432}],east:[{x:p.x,y:432},{x:1408,y:432}]};
    if(map==="town")this.scene.navigateSafeTownTo(paths[direction].slice(1));
    else if(map==="market"&&direction==="west")this.scene.navigateTo([{x:800,y:p.y},{x:800,y:540},{x:150,y:540},{x:24,y:432}]);
    else this.scene.navigateTo(paths[direction]);
  }
  private inventoryPage(){
    const progress=this.view!.progress,owned=bagEntries(progress,this.fish),total=bagQuantity(progress,this.fish);
    const player=this.player(),look=typeof player?.color==='number'?playerToLook(player):appearanceToLook(loadAppearance());
    this.wardrobe.render(this.body,progress,look,player?.name??'ตัวละครของฉัน',this.pending,(verb,payload)=>this.send(verb,payload),()=>this.render(true));
    const summary=document.createElement('div');summary.className='inventory-summary';summary.append(bagCanvas(),this.text('ของที่มีจริง','collection-plaque'),this.text(owned.length+' ชนิด · '+total+' ชิ้น'));
    this.body.append(summary,this.text('ของหมดจะหายจากกระเป๋า แต่ประวัติยังอยู่ในสมุดสะสม','inventory-explainer'));
    const tools=document.createElement('div');tools.className='inventory-tools';
    const search=document.createElement('input');search.type='search';search.placeholder='ค้นหาของที่มี…';search.setAttribute('aria-label','ค้นหาของในกระเป๋า');search.value=this.inventoryQuery;
    search.addEventListener('input',()=>{this.inventoryQuery=search.value;const cursor=search.selectionStart;this.render(true);const next=this.body.querySelector<HTMLInputElement>('input[type=search]');next?.focus();if(cursor!==null)next?.setSelectionRange(cursor,cursor);});
    const sort=document.createElement('select');sort.setAttribute('aria-label','เรียงของในกระเป๋า');for(const [id,label]of [['name','เรียงตามชื่อ'],['quantity','จำนวนมากก่อน']]){const option=document.createElement('option');option.value=id;option.textContent=label;sort.append(option);}sort.value=this.inventorySort;sort.onchange=()=>{this.inventorySort=sort.value;this.render(true);};tools.append(search,sort);this.body.append(tools);
    const book=document.createElement('div');book.className='collection-book inventory-book';const tabs=document.createElement('div');tabs.className='collection-tabs';
    for(const [category,icon]of [['ทั้งหมด','treasure'],['ปลา','carp'],['แมลง','butterfly'],['วัตถุดิบ','mushroom'],['อาหาร','garden-salad']]){const button=this.button(category,()=>{this.inventoryCategory=category;this.render(true);});button.prepend(itemCanvas(icon));button.setAttribute('aria-label',category);button.setAttribute('aria-pressed',String(this.inventoryCategory===category));tabs.append(button);}book.append(tabs);
    const content=document.createElement('div');content.className='collection-content';const grid=document.createElement('div');grid.className='world-collection';const detail=document.createElement('aside');detail.className='collection-inspector inventory-inspector';detail.setAttribute('aria-live','polite');
    const entries=owned.filter(e=>(this.inventoryCategory==='ทั้งหมด'||e.category===this.inventoryCategory||(this.inventoryCategory==='วัตถุดิบ'&&!['ปลา','แมลง','อาหาร'].includes(e.category)))&&e.name.includes(this.inventoryQuery.trim())).sort((a,b)=>this.inventorySort==='quantity'?b.count-a.count||a.name.localeCompare(b.name,'th'):a.name.localeCompare(b.name,'th'));
    const inspect=(entry:typeof entries[number])=>{this.selectedItem=entry.id;grid.querySelectorAll<HTMLElement>('[data-item]').forEach(card=>card.dataset.selected=String(card.dataset.item===entry.id));
      detail.replaceChildren(itemCanvas(entry.id),this.text(entry.name,'world-card-title'),this.text('ในกระเป๋า × '+entry.count,'collection-quantity'),this.text(entry.category,'collection-hint'));
      const uses=[...COSMETICS,...SEASON_GEAR].filter(c=>Object.prototype.hasOwnProperty.call(c.cost,entry.id)&&!progress.unlocks.includes(c.id));
      if(uses.length){const recipes=document.createElement('div');recipes.className='inventory-uses';for(const cosmetic of uses){const cost=Object.entries(cosmetic.cost) as [string,number][];const ready=cost.every(([id,n])=>(progress.inventory[id]??0)>=n);recipes.append(this.text((ready?'✓ พร้อมแลก ':'ใช้แลก ')+cosmetic.name+' · '+cost.map(([id,n])=>(ITEMS[id]?.name??id)+' '+Math.min(progress.inventory[id]??0,n)+'/'+n).join(' · ')));}recipes.append(this.text('ยืนยันแลกได้เมื่อเดินไปถึงร้านในตลาด'));detail.append(recipes);}
      else detail.append(this.text(entry.category==='ปลา'?'ปลาที่จับได้จะเก็บไว้ที่นี่ · ชิปจากการตกปลาเข้ากระเป๋าเงินแล้ว':'เก็บไว้ใช้แลกของหรือสะสมต่อได้','collection-hint'));
      const jobs=VILLAGE_ORDERS.filter(o=>Object.prototype.hasOwnProperty.call(o.cost,entry.id));
      if(jobs.length){const uses=document.createElement('div');uses.className='inventory-uses';for(const job of jobs)uses.append(this.text('ออร์เดอร์ '+job.name+' · ใช้ '+(job.cost as Record<string,number>)[entry.id]+' ชิ้น · '+SKILL_NAMES[job.skill]+' +'+job.xp+' XP'));uses.append(this.text('ส่งได้ที่กระดานออร์เดอร์ข้างน้ำพุ'));detail.append(uses);}
      if((entry.category==='ปลา'||entry.category==='แมลง')&&!progress.village?.museum.includes(entry.id))detail.append(this.text('มอบ 1 ตัวให้หอสะสมธรรมชาติได้ · ความชำนาญ +5 XP','collection-hint'));
      for(const recipe of RECIPES.filter(r=>Object.prototype.hasOwnProperty.call(r.cost,entry.id)))detail.append(this.text('ใช้ปรุง '+recipe.name+' ที่คาเฟ่','inventory-uses'));
      for(const furniture of FURNITURE.filter(f=>f.cost&&Object.prototype.hasOwnProperty.call(f.cost,entry.id)))detail.append(this.text('ใช้สร้าง '+furniture.name+' ที่เวิร์กช็อป','inventory-uses'));
      if(entry.category==='อาหาร')detail.append(this.text('นำอาหารร่วมปิกนิกที่ลานชุมชน · ใช้จริง 1 จาน ไม่ใช่การขายรับชิป','inventory-uses'));
    };
    for(const entry of entries){const card=document.createElement('article');card.dataset.item=entry.id;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',entry.name+' จำนวน '+entry.count);card.append(itemCanvas(entry.id),this.text(entry.name,'world-card-title'),this.text('× '+entry.count,'collection-count'));card.onclick=()=>inspect(entry);card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect(entry);}};grid.append(card);}
    if(entries.length){content.append(grid);book.append(content);this.body.append(book,detail);inspect(entries.find(e=>e.id===this.selectedItem)??entries[0]);}
    else{const empty=document.createElement('div');empty.className='inventory-empty';empty.append(bagCanvas(),this.text(owned.length?'ไม่พบของตามตัวกรอง':'ยังไม่มีของในกระเป๋า','world-card-title'),this.text(owned.length?'ลองเปลี่ยนหมวดหรือคำค้น':'จับแมลง ตกปลา เก็บหอย หรือปลูกผักเพื่อเริ่มเก็บของ'));
      if(owned.length)empty.append(this.button('ล้างตัวกรอง',()=>{this.inventoryCategory='ทั้งหมด';this.inventoryQuery='';this.render(true);}));else empty.append(this.button('ดูสมุดสะสม',()=>this.open('collection')));
      content.append(empty);book.append(content);this.body.append(book);}
    const resources=document.createElement('div');resources.className='inventory-resources';resources.append(this.text('💧 น้ำส่วนตัว '+(progress.water??2)+' หน่วย'),this.button('เปิดสมุดสะสม',()=>this.open('collection')));this.body.append(resources);
  }
  private collectionPage() {
    const progress=this.view!.progress,layout=document.createElement('div');layout.className='collection-book';
    const entries=catalogue(progress,this.fish,this.fishDiscoveries);
    const summary=document.createElement('div');summary.className='collection-summary';const found=entries.filter(e=>e.found).length;
    const meter=document.createElement('progress');meter.max=entries.length;meter.value=found;meter.setAttribute('aria-label','ความคืบหน้าของสะสม');
    summary.append(this.text('COLLECTION','collection-plaque'),this.text('พบแล้ว '+found+' / '+entries.length),meter);this.body.append(summary);
    this.body.append(this.text('บันทึกสิ่งที่เคยค้นพบ ไม่ใช่จำนวนของที่ถืออยู่ · ใช้ของหมดแล้วบันทึกยังอยู่','inventory-explainer'));
    const filters=document.createElement('div');filters.className='journal-filters';for(const [id,label]of [['all','ทั้งหมดที่บันทึก'],['found','ค้นพบแล้ว'],['missing','ยังไม่พบ']]){const b=this.button(label,()=>{this.journalFilter=id;this.render(true);});b.setAttribute('aria-pressed',String(this.journalFilter===id));filters.append(b);}filters.append(this.button('เปิดกระเป๋าของจริง',()=>this.open('inventory')));this.body.append(filters);
    const tabs=document.createElement('div');tabs.className='collection-tabs';
    const icons:Record<string,string>={ทั้งหมด:'treasure',ปลา:'carp',แมลง:'butterfly',ของสะสม:'shell',สัตว์:'animal-friend'};
    for(const category of Object.keys(icons)){const button=this.button(category,()=>{this.category=category;this.render(true);});button.setAttribute('aria-label',category);button.prepend(itemCanvas(icons[category]));button.setAttribute('aria-pressed',String(this.category===category));tabs.append(button);}
    const content=document.createElement('div');content.className='collection-content';const detail=document.createElement('aside');detail.className='collection-inspector';detail.setAttribute('aria-live','polite');
    const inspect=(entry:typeof entries[number])=>{this.selectedItem=entry.id;content.querySelectorAll<HTMLElement>('[data-item]').forEach(card=>card.dataset.selected=String(card.dataset.item===entry.id));
      const hint=COLLECTION_HINTS[entry.id]??(entry.category==='แมลง'?'เดินเข้าใกล้แมลงในแมพ แล้วกด E หรือแตะจับ':entry.category==='ปลา'?(["mackerel","clownfish","seahorse"].includes(entry.id)?'หาดสายลม · ตกปลาริมทะเลหรือท่าเรือ':'เมืองกลาง · ตกปลารอบบ่อ'):'สำรวจโลกเพื่อค้นพบ');
      detail.replaceChildren(itemCanvas(entry.id),this.text(entry.name,'world-card-title'),this.text(entry.found?'เคยค้นพบแล้ว ✓':'ยังไม่ค้นพบ','collection-quantity'),this.text(entry.record?'บันทึกกิจกรรม / ความสำเร็จ ไม่ใช่สิ่งของในกระเป๋า':entry.count>0?'ของที่มีตอนนี้ × '+entry.count:'ตอนนี้ไม่มีของชิ้นนี้ในกระเป๋า','collection-hint'),this.text(hint,'collection-hint'));
    };
    const filtered=entries.filter(e=>(this.category==='ทั้งหมด'||e.category===this.category||(this.category==='ของสะสม'&&!['ปลา','แมลง','สัตว์'].includes(e.category)))&&(this.journalFilter==='all'||(this.journalFilter==='found'?e.found:!e.found)));
    for(const category of ['ปลา','แมลง','ของป่า','ชายหาด','ผลผลิต','อาหาร','สัตว์','กิจกรรม'].filter(category=>filtered.some(e=>e.category===category))){
      const group=document.createElement('section');group.className='collection-group';group.append(this.text(category,'collection-group-title'));
      const grid=document.createElement('div');grid.className='world-collection';
      for(const entry of filtered.filter(e=>e.category===category)){
        const card=document.createElement('article');card.className=entry.found?'':'world-locked';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',entry.name+(entry.found?' ค้นพบแล้ว':' ยังไม่พบ'));card.dataset.item=entry.id;
        card.append(itemCanvas(entry.id),this.text(entry.found?entry.name:'?','world-card-title'),this.text(entry.found?'✓':'ยังไม่พบ','collection-count'));
        card.addEventListener('click',()=>inspect(entry));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect(entry);}});grid.append(card);
      }group.append(grid);content.append(group);
    }
    layout.append(tabs,content);this.body.append(layout);if(filtered.length){this.body.append(detail);inspect(filtered.find(e=>e.id===this.selectedItem)??filtered[0]);}else content.append(this.text('ยังไม่มีรายการในหมวดนี้ · ลองเปลี่ยนตัวกรอง'));
  }
  private villagePage(){
    const p=this.view!.progress,v=p.village??{xp:{},completed:[],museum:[]};
    const skills=document.createElement('div');skills.className='village-skills';
    for(const [id,name]of Object.entries(SKILL_NAMES)){const xp=v.xp[id]??0,level=villageLevel(xp),card=document.createElement('article'),bar=document.createElement('progress');bar.max=25*level*level-25*(level-1)*(level-1);bar.value=xp-25*(level-1)*(level-1);bar.setAttribute('aria-label',name+' ระดับ '+level);card.append(this.text(name+' · Lv.'+level),bar,this.text(xp+' XP'));skills.append(card);}this.body.append(skills);
    const stock=(id:string)=>FISH_SPECIES.some(f=>f.id===id)?this.fish[id]??0:p.inventory[id]??0;
    const name=(id:string)=>ITEMS[id]?.name??FISH_SPECIES.find(f=>f.id===id)?.name??id;
    const ingredients=(cost:Record<string,number>)=>{const row=document.createElement('div');row.className='village-ingredients';for(const [id,n]of Object.entries(cost)){const cell=document.createElement('div');cell.dataset.enough=String(stock(id)>=n);cell.append(itemCanvas(id),this.text(name(id)),this.text(stock(id)+' / '+n));row.append(cell);}return row;};
    if(this.villageConfirmation){
      const confirmation=this.villageConfirmation,order=VILLAGE_ORDERS.find(o=>o.id===confirmation.id),cost=confirmation.verb==='order-submit'?order!.cost as Record<string,number>:{[confirmation.id]:1};
      const confirm=document.createElement('section');confirm.className='village-confirmation';confirm.setAttribute('role','group');confirm.setAttribute('aria-label','ยืนยันการใช้วัตถุดิบ');
      confirm.append(this.text('ตรวจรายการก่อนส่ง','world-card-title'),ingredients(cost),this.text('ของตามรายการจะถูกหักจริง · สมุดยังจำว่าเคยพบ · ไม่หักหรือเพิ่มชิป'));
      confirm.append(this.button('ยืนยันส่งของ',()=>{this.villageConfirmation=undefined;this.send(confirmation.verb,{confirmed:true,...(confirmation.verb==='order-submit'?{orderId:confirmation.id}:{itemId:confirmation.id})});},this.pending||!Object.entries(cost).every(([id,n])=>stock(id)>=n)),this.button('ยกเลิก ไม่ใช้ของ',()=>{this.villageConfirmation=undefined;this.render(true);},this.pending));this.body.append(confirm);return;
    }
    if(this.page==='orders'){
      this.body.append(this.text('เลือกช่วยงานที่ชอบ ไม่ต้องรับทุกงาน · ส่งสำเร็จพักออร์เดอร์นั้น 24 ชั่วโมง · ไม่มีค่าปรับเมื่อไม่เล่น'));
      const grid=document.createElement('div');grid.className='village-orders';
      for(const order of VILLAGE_ORDERS){const card=document.createElement('article');card.dataset.order=order.id;const cost=order.cost as Record<string,number>,ready=Object.entries(cost).every(([id,n])=>stock(id)>=n),cooldown=p.cooldowns['order:'+order.id]??0;
        card.append(this.text(order.npc,'village-npc'),this.text(order.name,'world-card-title'),ingredients(cost),this.text(SKILL_NAMES[order.skill]+' +'+order.xp+' XP'));
        if(order.reward){const cosmetic=COSMETICS.find(c=>c.id===order.reward)!;const reward=document.createElement('div');reward.className='village-reward';reward.append(itemCanvas(cosmetic.id),this.text((v.completed.includes(order.id)?'รับรางวัลครั้งแรกแล้ว: ':p.unlocks.includes(cosmetic.id)?'มีชุดนี้แล้ว · ยังรับ XP ได้: ':'ครั้งแรกปลดล็อก: ')+cosmetic.name));card.append(reward);}
        const gear=NEW_GEAR.find(g=>g.quest===order.id);if(gear){const reward=document.createElement('div');reward.className='village-reward';reward.append(itemCanvas(gear.id),this.text(p.unlocks.includes(gear.id)?'รับอุปกรณ์แล้ว: '+gear.name:'รางวัลอุปกรณ์ครั้งแรก: '+gear.name));if(v.completed.includes(order.id)&&!p.unlocks.includes(gear.id))reward.append(this.button('รับอุปกรณ์เพิ่มเติม',()=>this.send('quest-gear-claim',{orderId:order.id}),this.pending));card.append(reward);}
        if(cooldown>Date.now())card.append(this.text('พักอีก '+Math.ceil((cooldown-Date.now())/3600000)+' ชั่วโมง'));
        card.append(this.button(cooldown>Date.now()?'ส่งแล้ว รอรอบใหม่':ready?'ตรวจรายการส่งของ':'วัตถุดิบยังไม่ครบ',()=>{this.villageConfirmation={verb:'order-submit',id:order.id};this.render(true);},this.pending||!ready||cooldown>Date.now()));grid.append(card);
      }this.body.append(grid);
    }else{
      this.body.append(this.text('หอสะสมส่วนตัว · มอบปลา/แมลงชนิดละ 1 ตัวเพียงครั้งเดียว · ทุกชนิดได้ความชำนาญ +5 XP'));
      this.body.append(this.text('จัดแสดงแล้ว '+v.museum.length+' / 12 ชนิด · ครบ 5 ชนิดปลดล็อกหมวกแมว'));
      const grid=document.createElement('div');grid.className='village-orders';for(const id of [...FISH_SPECIES.map(f=>f.id),'bee','ladybug','butterfly','beetle','firefly']){const card=document.createElement('article');card.dataset.specimen=id;card.append(itemCanvas(id),this.text(name(id),'world-card-title'),this.text(v.museum.includes(id)?'จัดแสดงถาวรแล้ว ✓':'มีในกระเป๋า '+stock(id)));
        card.append(this.button(v.museum.includes(id)?'มอบแล้ว':'ตรวจรายการมอบตัวอย่าง',()=>{this.villageConfirmation={verb:'museum-donate',id};this.render(true);},this.pending||v.museum.includes(id)||stock(id)<1));grid.append(card);}this.body.append(grid);
    }
  }
  private cafePage(){
    this.title.textContent='CAFE';
    this.body.append(this.button('ปรุงอาหารจากวัตถุดิบในกระเป๋า',()=>this.open('cooking')));
    const c=this.view!.cafe,id=this.player()?.playerId,member=c.members.find(m=>m.id===id);
    const foodId=c.recipe==='ซุปแครอท'||c.recipe==='soup'?'soup':'salad';
    const kitchen=document.createElement('div');kitchen.className='world-cafe-room';kitchen.dataset.phase=c.phase;kitchen.setAttribute('aria-label','ครัวและสมาชิกทีมจริง');
    const actors=document.createElement('div');actors.className='cafe-actors';
    for(let index=0;index<4;index++){
      const station=document.createElement('div');station.className='world-cafe-worker';const m=c.members[index];
      if(m){let player:any;this.room.state?.players?.forEach((p:any)=>{if(p.playerId===m.id)player=p;});
        if(player){const pose:CharacterPose=(['standing','prepare','cook','serve'] as const)[index];const avatar=renderCharacterCanvas(playerToLook(player),'down',0,pose);avatar.getContext('2d')!.drawImage(equipmentCanvas(wireEquipment(player),'down',pose),0,0);station.append(avatar);}
        station.append(this.text(m.name,'cafe-worker-name'));
      }else station.append(this.text('ว่าง','cafe-worker-name'));
      actors.append(station);
    }
    const bubbles=document.createElement('div');bubbles.className='cafe-orders';
    const tasks=document.createElement('div');tasks.className='world-cafe-stations';
    STATIONS.forEach((station,index)=>{
      const bubble=document.createElement('div');bubble.className='cafe-order-bubble';bubble.dataset.station=String(index);
      bubble.append(itemCanvas(index===0||index===3?foodId:index===1?'cafe-prepare':'cafe-cook'));
      const progress=document.createElement('progress');progress.max=1;progress.value=c.phase==='running'?Number(index<c.order):c.phase==='result'&&c.served>=3?1:0;
      progress.setAttribute('aria-label',station+' ของออร์เดอร์ปัจจุบัน');bubble.append(progress);bubbles.append(bubble);
      const card=document.createElement('article');card.dataset.active=String(c.phase==='running'&&index===c.order);card.dataset.done=String(c.phase==='running'&&index<c.order);
      const label=station+(c.phase==='running'&&index===c.order?' ← ตอนนี้':'');
      const button=this.button(label,()=>this.send('cafe-work',{station:index,roundId:c.roundId}),this.pending||!member||c.phase!=='running'||index!==c.order);
      button.dataset.station=String(index);card.append(button);tasks.append(card);
    });
    const steam=document.createElement('div');steam.className='cafe-steam';steam.hidden=c.phase!=='running'||c.order!==2;steam.setAttribute('aria-hidden','true');for(let i=0;i<3;i++)steam.append(document.createElement('span'));
    const front=document.createElement('div');front.className='cafe-counter-front';for(let i=0;i<2;i++){const counter=document.createElement('img');counter.src='/art/activity-v2/activity-counter.png';counter.alt='';front.append(counter);}
    kitchen.append(actors,bubbles,steam,front,tasks);this.body.append(kitchen);
    const order=document.createElement('div');order.className='world-cafe-order';
    order.append(itemCanvas(foodId),this.text((foodId==='soup'?'ซุปแครอท':'สลัดสวน')+' · เสิร์ฟ '+c.served+' / 3 จาน · ทีม '+c.members.length+' / 4 คน','world-card-title'));
    this.body.append(order);
    if(!member){this.body.append(this.button('เข้าทีม',()=>this.send('cafe-join'),this.pending||c.phase!=='lobby'||c.members.length>=4));return;}
    const actions=document.createElement('div');actions.className='cafe-footer-actions';
    if(c.phase==='lobby'){
      this.body.append(this.text('เพื่อน 2–4 คนช่วยกันได้ทุกสถานี · รูปคนในครัวเป็นสมาชิกจริง'));
      const recipe=document.createElement('select');recipe.setAttribute('aria-label','สูตรอาหาร');
      for(const [value,name]of [['salad','สลัดสวน'],['soup','ซุปแครอท (เก็บแครอทเพื่อปลดล็อก)']]){const option=document.createElement('option');option.value=value;option.textContent=name;recipe.append(option);}recipe.value=this.recipe;recipe.onchange=()=>this.recipe=recipe.value;
      const ready=this.button('READY · เริ่มครัว',()=>this.send('cafe-start',{recipe:this.recipe}),this.pending||c.host!==id||c.members.length<2);ready.setAttribute('aria-label','เริ่มครัว');ready.className='cafe-ready';actions.append(recipe,ready);
    }else if(c.phase==='running'){
      const timer=this.text('','cafe-deadline');timer.dataset.readyAt=String(c.deadline);actions.append(timer,this.text('ช่วยงานตามลำดับที่สว่าง · ทุกคนกดช่วยได้ทุกสถานี'));
    }else{
      this.body.append(this.text(c.served>=3?'สำเร็จ! ผู้ที่ลงมือช่วยได้รับบันทึกครัวแล้ว':'หมดเวลา ลองใหม่ได้ ไม่มีการเสียชิป'));
      actions.append(this.button('เตรียมรอบใหม่',()=>this.send('cafe-reset'),this.pending||c.host!==id));
    }
    actions.append(this.button('ออกจากทีม',()=>this.send('cafe-leave'),this.pending));this.body.append(actions);
  }
  private shopPage(){
    this.body.append(this.text("แลกด้วยของสะสม ไม่มีเงินจริงและไม่ซื้อความได้เปรียบ · ทดลองชุดบนตัวเราก่อนแลก"));
    const grid=document.createElement("div");grid.className="world-collection";
    for(const cosmetic of COSMETICS.slice(1)){
      const card=document.createElement("article"),base=renderCharacterCanvas(appearanceToLook(loadAppearance()));
      base.getContext("2d")!.drawImage(cosmeticCanvas(cosmetic.id),0,0);card.append(base,this.text(cosmetic.name,"world-card-title"));
      card.append(this.text(Object.entries(cosmetic.cost).map(([id,n])=>(ITEMS[id]?.name??id)+" × "+n).join(" · ")));
      const owned=this.view!.progress.unlocks.includes(cosmetic.id);
      card.append(this.button(owned?"ใส่ชุดนี้":"ยืนยันแลก",()=>this.send(owned?"equip":"exchange",{cosmeticId:cosmetic.id}),this.pending));
      grid.append(card);
    }
    for(const item of SEASON_GEAR){
      const card=document.createElement('article'),preview=renderCharacterCanvas(appearanceToLook(loadAppearance()));preview.getContext('2d')!.drawImage(equipmentCanvas({body:item.id}),0,0);
      card.dataset.tailor=item.id;card.append(preview,this.text(item.name,'world-card-title'),this.text(Object.entries(item.cost).map(([id,n])=>(ITEMS[id]?.name??id)+' × '+n).join(' · ')));
      const owned=this.view!.progress.unlocks.includes(item.id),enough=Object.entries(item.cost).every(([id,n])=>(this.view!.progress.inventory[id]??0)>=n);
      card.append(this.button(owned?'สวมใส่':enough?'ยืนยันแลกชุด':'วัตถุดิบยังไม่ครบ',()=>this.send(owned?'equip-slot':'tailor-exchange',owned?{slot:'body',itemId:item.id}:{itemId:item.id,confirmed:true}),this.pending||!owned&&!enough));grid.append(card);
    }this.body.append(grid);
  }
  private drawMinimap(){
    const c=this.minimap.getContext("2d")!,p=this.player();if(!p)return;c.imageSmoothingEnabled=false;
    const map=(p.mapId??"town") as MapId;if(!this.grounds.has(map))this.grounds.set(map,groundCanvas(map));c.drawImage(this.grounds.get(map)!,0,0,120,72);c.fillStyle="#f7d881";
    for(const [direction,x,y]of [["north",60,3],["south",60,69],["west",3,36],["east",117,36]] as [Direction,number,number][]){if(destination(map,direction))c.fillRect(x-2,y-2,4,4);}
    c.fillStyle="#f9a3a5";c.fillRect(Math.round(p.x/1440*120)-2,Math.round(p.y/864*72)-2,4,4);
  }
}
