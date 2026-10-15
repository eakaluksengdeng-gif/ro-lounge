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
const STATIONS=["รับออร์เดอร์","เตรียม","ปรุง","เสิร์ฟ"];
const COLLECTION_HINTS:Record<string,string>={
  butterfly:"ป่าน้ำตก · ผีเสื้อฟ้าตามทาง",beetle:"ป่าน้ำตก · ด้วงทองฝั่งตะวันออก",firefly:"ป่าน้ำตก · ตอนเย็นหรือกลางคืน",
  mushroom:"ป่าน้ำตก · ใต้ต้นไม้", "snow-rabbit":"ป่าน้ำตก · เมื่อหิมะตก", "animal-friend":"ฟาร์ม · ให้อาหารแมวและกระต่าย",
  carrot:"ฟาร์ม · ปลูก รดน้ำ และเก็บเกี่ยว",tomato:"ฟาร์ม · ปลูก รดน้ำ และเก็บเกี่ยว",wheat:"ฟาร์ม · ปลูก รดน้ำ และเก็บเกี่ยว",
  shell:"หาดสายลม · ตามริมทราย",pearl:"หาดสายลม · เปลือกหอยกลางหาด",treasure:"หาดสายลม · หีบเก่าฝั่งตะวันตก",
  cleanup:"หาดสายลม · ช่วยเก็บขยะ",voyager:"หาดสายลม · ล่องเรือกลับถึงท่า",camper:"ป่าน้ำตก · นั่งข้างกองไฟ",
  chef:"ตลาดโคมไฟ · ช่วยทีมเสิร์ฟอาหารครบ 3 จาน",musician:"ตลาดโคมไฟ · เล่นเวทีดนตรี",
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
  private owner="";
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
  constructor(private room:Room,private scene:TownScene) {
    this.toolbar.id="worldToolbar";this.minimap.width=120;this.minimap.height=72;this.minimap.setAttribute("aria-label","แผนที่ย่อและตำแหน่งของคุณ");
    const bag=this.button('กระเป๋า',()=>this.open('inventory'));bag.id='worldBagButton';bag.setAttribute('aria-label','กระเป๋า');bag.title='กระเป๋า · B';this.bagCount.className='bag-count';this.bagCount.setAttribute('aria-hidden','true');bag.prepend(bagCanvas());bag.append(this.bagCount);
    this.toolbar.append(this.mapLabel,this.minimap,this.button("🧭 แผนที่",()=>this.open("map")),this.button("สมุดสะสม",()=>this.open("collection")),bag);
    document.body.append(this.toolbar);
    this.interact.id="worldInteract";this.interact.type="button";this.interact.hidden=true;
    this.interact.addEventListener("click",()=>this.activate());document.body.append(this.interact);
    this.toast.id='worldToast';this.toast.hidden=true;this.toast.setAttribute('role','status');document.body.append(this.toast);
    this.panel.id="worldPanel";this.panel.hidden=true;this.panel.setAttribute("role","dialog");this.panel.setAttribute("aria-modal","true");this.panel.setAttribute("aria-label","สำรวจโลกและกิจกรรม");
    const frame=document.createElement("div");frame.className="world-frame";
    const header=document.createElement("header");header.append(this.title,this.button("ปิด",()=>this.close()));
    this.notice.id="worldNotice";this.notice.setAttribute("role","status");frame.append(header,this.notice,this.body);this.panel.append(frame);document.body.append(this.panel);
    this.room.onMessage<WorldView>("world:state",view=>{
      this.view=view;this.scene.setWorldView(view);this.mapLabel.textContent=MAP_NAMES[view.map];
      if(view.map!==this.previousMap){this.close();this.previousMap=view.map;gameSounds.play("join");}
      if(view.notice){this.notice.textContent=view.notice;this.pending=false;window.clearTimeout(this.pendingTimer);
        this.showToast(view.notice);
        if(this.pendingVerb!=="note")gameSounds.play(this.pendingVerb==="exchange"?"win":['collect','catch'].includes(this.pendingVerb)?"catch":"select");
        if(this.pendingVerb==="boat"||this.pendingVerb==="sit")this.close();this.pendingVerb="";this.render(true);}
      else this.render();
    });
    this.room.onMessage<FishingState>("fish:state",state=>{this.fish={...state.inventory} as Record<string,number>;this.render();});
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
      if(this.node){event.preventDefault();this.activate();}
    },{signal:this.controller.signal});
    const timer=window.setInterval(()=>this.update(),200);
    this.room.onLeave(()=>{this.controller.abort();window.clearInterval(timer);window.clearTimeout(this.pendingTimer);window.clearTimeout(this.toastTimer);this.toast.remove();this.close();this.toolbar.remove();this.interact.remove();this.panel.remove();});
    this.room.send("world:sync",{});
    const direct=(id:string)=>{const node=WORLD_NODES.find(n=>n.id===id);const p=this.player();if(node&&p&&node.map===p.mapId&&Math.hypot(p.x-node.x,p.y-node.y)<=100){this.node=node;this.activate();}};
    this.scene.interactions?.on('world:interact',direct);
    this.room.onLeave(()=>this.scene.interactions?.off('world:interact',direct));
    const wild=(id:string)=>{const node=this.wildlifeNode(id),p=this.player();if(node&&p&&Math.hypot(p.x-node.x,p.y-node.y)<=100){this.node=node;this.activate();}};
    this.scene.interactions?.on('world:wildlife',wild);this.room.onLeave(()=>this.scene.interactions?.off('world:wildlife',wild));
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
  private open(page:string) {if(!this.view||this.scene.casinoOpen)return;this.page=page;this.panel.hidden=false;this.scene.worldOpen=true;document.body.classList.add("world-ui-open");this.notice.textContent="";this.render(true);}
  private close(){this.panel.hidden=true;this.scene.worldOpen=false;document.body.classList.remove("world-ui-open");}
  private update() {
    const p=this.player();if(!p)return;
    if(this.scene.casinoOpen&&!this.panel.hidden)this.close();
    this.toolbar.hidden=this.scene.casinoOpen;
    const nearby=WORLD_NODES.filter(n=>n.map===(p.mapId??'town'));
    this.room.state?.wildlife?.forEach((_animal:WildlifeView,id:string)=>{const node=this.wildlifeNode(id);if(node&&(this.view?.progress.cooldowns[node.id]??0)<=Date.now())nearby.push(node);});
    if(this.panel.hidden)this.node=nearby.filter(n=>Math.hypot(p.x-n.x,p.y-n.y)<=100).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
    this.bagCount.textContent=String(Object.values(this.view?.progress.inventory??{}).reduce((a,b)=>a+b,0)+Object.values(this.fish).reduce((a,b)=>a+b,0));
    this.interact.hidden=!this.node||this.scene.casinoOpen||!this.panel.hidden||p.activity==="boat";
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
    const sig=JSON.stringify([this.page,this.view.progress,this.view.farms,this.view.cafe,this.view.boat,this.view.cleanup,this.fish,this.pending,this.node?.id,
      this.view.farms.flatMap(farm=>farm.plots.map(crop=>crop?Date.now()>=crop.readyAt:false)),
      Date.now()>=(this.view.progress.cooldowns[this.node?.id??""]??0)]);
    if(!force&&sig===this.signature)return;this.signature=sig;this.body.replaceChildren();
    this.panel.dataset.page=this.page;
    if(this.page==="map"){this.title.textContent="โลกของ RO Lounge";this.mapPage();return;}
    if(this.page==="collection"||this.page==="inventory"){this.title.textContent=this.page==="collection"?"สมุดสะสม":"กระเป๋าและชุด";this.collectionPage();return;}
    if(!this.node){this.body.append(this.text("กลับไปใกล้จุดกิจกรรมเพื่อใช้งาน"));return;}
    this.title.textContent=this.node.name;
    if(["farm","greenhouse"].includes(this.page)){this.farmPage();return;}
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
      const activities={town:"Boardgame · บ่อปลา · แชท",forest:"แมลง · เห็ด · กระต่ายหิมะ · แคมป์",farm:"ปลูกผัก · โรงเรือน · รดน้ำเพื่อน · สัตว์",beach:"ปลาทะเล · หอย · สมบัติ · เก็บขยะ · เรือ",market:"ครัว 2–4 คน · ร้านชุด · เวทีดนตรี"};
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
  private collectionPage() {
    const progress=this.view!.progress,layout=document.createElement('div');layout.className='collection-book';
    const entries=[...Object.entries(ITEMS).map(([id,item])=>({id,...item,count:progress.inventory[id]??0,found:progress.discovered.includes(id)})),...FISH_SPECIES.map(f=>({id:f.id,name:f.name,icon:"🐟",category:"ปลา",count:this.fish[f.id]??0,found:(this.fish[f.id]??0)>0}))];
    const summary=document.createElement('div');summary.className='collection-summary';const found=entries.filter(e=>e.found).length;
    const meter=document.createElement('progress');meter.max=entries.length;meter.value=found;meter.setAttribute('aria-label','ความคืบหน้าของสะสม');
    summary.append(this.text('COLLECTION','collection-plaque'),this.text('พบแล้ว '+found+' / '+entries.length),meter);this.body.append(summary);
    const tabs=document.createElement('div');tabs.className='collection-tabs';
    const icons:Record<string,string>={ทั้งหมด:'treasure',ปลา:'carp',แมลง:'butterfly',ของสะสม:'shell',สัตว์:'animal-friend'};
    for(const category of Object.keys(icons)){const button=this.button(category,()=>{this.category=category;this.render(true);});button.setAttribute('aria-label',category);button.prepend(itemCanvas(icons[category]));button.setAttribute('aria-pressed',String(this.category===category));tabs.append(button);}
    const content=document.createElement('div');content.className='collection-content';const detail=document.createElement('aside');detail.className='collection-inspector';detail.setAttribute('aria-live','polite');
    const inspect=(entry:typeof entries[number])=>{this.selectedItem=entry.id;content.querySelectorAll<HTMLElement>('[data-item]').forEach(card=>card.dataset.selected=String(card.dataset.item===entry.id));
      const hint=COLLECTION_HINTS[entry.id]??(entry.category==='แมลง'?'เดินเข้าใกล้แมลงในแมพ แล้วกด E หรือแตะจับ':entry.category==='ปลา'?(["mackerel","clownfish","seahorse"].includes(entry.id)?'หาดสายลม · ตกปลาริมทะเลหรือท่าเรือ':'เมืองกลาง · ตกปลารอบบ่อ'):'สำรวจโลกเพื่อค้นพบ');
      detail.replaceChildren(itemCanvas(entry.id),this.text(entry.name,'world-card-title'),this.text('ในกระเป๋า × '+entry.count,'collection-quantity'),this.text(entry.found?'ค้นพบแล้ว ✓':'ยังไม่ค้นพบ'),this.text(hint,'collection-hint'));
    };
    const filtered=entries.filter(e=>this.category==='ทั้งหมด'||e.category===this.category||(this.category==='ของสะสม'&&!['ปลา','แมลง','สัตว์'].includes(e.category)));
    for(const category of ['ปลา','แมลง','ของป่า','ชายหาด','ผลผลิต','สัตว์','กิจกรรม'].filter(category=>filtered.some(e=>e.category===category))){
      const group=document.createElement('section');group.className='collection-group';group.append(this.text(category,'collection-group-title'));
      const grid=document.createElement('div');grid.className='world-collection';
      for(const entry of filtered.filter(e=>e.category===category)){
        const card=document.createElement('article');card.className=entry.found?'':'world-locked';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',entry.name+' จำนวน '+entry.count);card.dataset.item=entry.id;
        card.append(itemCanvas(entry.id),this.text(entry.found?entry.name:'?','world-card-title'),this.text('× '+entry.count,'collection-count'));
        card.addEventListener('click',()=>inspect(entry));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect(entry);}});grid.append(card);
      }group.append(grid);content.append(group);
    }
    layout.append(tabs,content);this.body.append(layout,detail);inspect(filtered.find(e=>e.id===this.selectedItem)??filtered[0]);
    const outfits=document.createElement("div");outfits.className="world-actions";
    for(const cosmetic of COSMETICS)if(progress.unlocks.includes(cosmetic.id))outfits.append(this.button(cosmetic.name+(progress.equipped===cosmetic.id?" ✓":""),()=>this.send("equip",{cosmeticId:cosmetic.id}),this.pending));
    this.body.append(this.text("ชุดและเครื่องประดับที่มี"),outfits);
  }
  private farmPage() {
    const water=document.createElement('div');water.className='water-supply';water.append(this.text('💧 น้ำของคุณ '+(this.view!.progress.water??2)+' หน่วย'));
    water.append(this.button('＋ ไปตักน้ำ',()=>{this.close();this.scene.navigateTo([{x:800,y:520}]);}));this.body.append(water);
    const mine=this.player()?.playerId,farms=this.view!.farms;
    if(!this.owner||!farms.some(f=>f.id===this.owner))this.owner=mine;
    const select=document.createElement("select");select.setAttribute("aria-label","เลือกแปลงเจ้าของ");for(const farm of farms){const opt=document.createElement("option");opt.value=farm.id;opt.textContent=farm.name+(farm.id===mine?" (คุณ)":"");select.append(opt);}select.value=this.owner;
    select.addEventListener("change",()=>{this.owner=select.value;this.render(true);});this.body.append(select);
    const farm=farms.find(f=>f.id===this.owner);if(!farm)return;
    if(farm.id===mine)this.body.append(this.button(farm.allowHelp?"ปิดให้เพื่อนช่วยรดน้ำ":"เปิดให้เพื่อนช่วยรดน้ำ",()=>this.send("allow-help",{ownerId:mine,allow:!farm.allowHelp}),this.pending));
    else this.body.append(this.text(farm.allowHelp?"เจ้าของอนุญาตให้ช่วยรดน้ำ":"เจ้าของยังไม่อนุญาต · เก็บเกี่ยวได้เฉพาะเจ้าของ"));
    const grid=document.createElement("div");grid.className="world-collection";
    const slots=this.page==="greenhouse"?[4,5]:[0,1,2,3];
    for(const slot of slots){const crop=farm.plots[slot],card=document.createElement("article");card.append(this.text("แปลง "+(slot+1),"world-card-title"));
      if(!crop){card.append(this.text("เลือกเมล็ด · ปลูกฟรี"));for(const seed of SEEDS){const button=this.button("ปลูก"+seed.name,()=>this.send("plant",{ownerId:this.owner,slot,seed:seed.id}),this.pending||this.owner!==mine);button.className='seed-choice';button.prepend(itemCanvas(seed.id));card.append(button);}}
      else {card.append(itemCanvas(crop.seed),this.text(SEEDS.find(s=>s.id===crop.seed)!.name));const timer=this.text("");timer.dataset.readyAt=String(crop.readyAt);card.append(timer,this.text(crop.watered?"รดน้ำแล้ว":"ต้องรดน้ำ"));
        const growth=document.createElement('progress');growth.max=1;growth.value=Math.min(1,(Date.now()-crop.plantedAt)/(crop.readyAt-crop.plantedAt));growth.setAttribute('aria-label','การเติบโต');card.append(growth);
        card.append(this.button("💧 รดน้ำ −1",()=>this.send("water",{ownerId:this.owner,slot}),this.pending||crop.watered||(this.view!.progress.water??2)<=0||(this.owner!==mine&&!farm.allowHelp)),this.button("เก็บเกี่ยว",()=>this.send("harvest",{ownerId:this.owner,slot}),this.pending||this.owner!==mine||!crop.watered||Date.now()<crop.readyAt));}
      grid.append(card);
    }this.body.append(grid,this.text("ผักเติบโตต่อเมื่อออกเกม · เมล็ดฟรี · แปลงและผลผลิตเก็บที่เซิร์ฟเวอร์"));
  }
  private cafePage(){
    this.title.textContent='CAFE';
    const c=this.view!.cafe,id=this.player()?.playerId,member=c.members.find(m=>m.id===id);
    const foodId=c.recipe==='ซุปแครอท'||c.recipe==='soup'?'soup':'salad';
    const kitchen=document.createElement('div');kitchen.className='world-cafe-room';kitchen.dataset.phase=c.phase;kitchen.setAttribute('aria-label','ครัวและสมาชิกทีมจริง');
    const actors=document.createElement('div');actors.className='cafe-actors';
    for(let index=0;index<4;index++){
      const station=document.createElement('div');station.className='world-cafe-worker';const m=c.members[index];
      if(m){let player:any;this.room.state?.players?.forEach((p:any)=>{if(p.playerId===m.id)player=p;});
        if(player){const pose:CharacterPose=(['standing','prepare','cook','serve'] as const)[index];const avatar=renderCharacterCanvas(playerToLook(player),'down',0,pose);avatar.getContext('2d')!.drawImage(cosmeticCanvas(player.cosmetic||'none'),0,0);station.append(avatar);}
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
    }this.body.append(grid);
  }
  private drawMinimap(){
    const c=this.minimap.getContext("2d")!,p=this.player();if(!p)return;c.imageSmoothingEnabled=false;
    const map=(p.mapId??"town") as MapId;if(!this.grounds.has(map))this.grounds.set(map,groundCanvas(map));c.drawImage(this.grounds.get(map)!,0,0,120,72);c.fillStyle="#f7d881";
    for(const [direction,x,y]of [["north",60,3],["south",60,69],["west",3,36],["east",117,36]] as [Direction,number,number][]){if(destination(map,direction))c.fillRect(x-2,y-2,4,4);}
    c.fillStyle="#f9a3a5";c.fillRect(Math.round(p.x/1440*120)-2,Math.round(p.y/864*72)-2,4,4);
  }
}
