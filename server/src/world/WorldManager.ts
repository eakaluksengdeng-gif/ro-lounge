import { randomUUID } from "node:crypto";
import { MAP_IDS, WORLD_NODES, SEEDS, COSMETICS, type MapId, type Progress, type WorldNode, type CafeView, type BoatView, type WorldView, type SeedId } from "../../../shared/regions";
import { requireGame, objectPayload } from "../pokdeng/errors";
import type { SnapshotStore } from "../storage/SnapshotStore";
import { CATCHABLE_BUGS,wildlifeCatchKey,type WildlifeView } from '../../../shared/nature';
import { worldBlocked } from '../../../shared/regions';
import {VILLAGE_ORDERS,ORDER_COOLDOWN} from '../../../shared/village';
import {FISH_SPECIES} from '../../../shared/nature';
import type {FishingManager} from '../nature/FishingManager';
import {CozyManager} from './CozyManager';
import {cozyFresh} from '../../../shared/cozy';
import {FARM_PLOTS} from '../../../shared/regions';
export interface WorldActor { id:string; name:string; map:MapId; x:number; y:number; inCasino?:boolean; }
const fresh = ():Progress => ({map:"town",water:2,inventory:{},discovered:[],plots:Array(6).fill(null),allowHelp:false,unlocks:["none"],equipped:"none",cooldowns:{}});
const cafeFresh = ():CafeView => ({phase:"lobby",members:[],host:null,deadline:null,order:0,served:0,recipe:"สลัดสวน",roundId:null});
/** Profile changes are staged and persisted before installation; no client quantity/reward is trusted. */
export class WorldManager {
  private profiles = new Map<string,Progress>();
  private names = new Map<string,string>();
  private seen = new Map<string,Map<string,string>>();
  private cafe:CafeView = cafeFresh();
  private boat:BoatView|null = null;
  private cleanup = 0;
  private musicRate = new Map<string,number>();
  private activeReceipt?:{id:string;request:string};
  private cozy:CozyManager;
  constructor(private store?:SnapshotStore, private now:()=>number=Date.now,private fishing?:FishingManager) {
    this.cozy=new CozyManager(store,now);
    this.profiles = new Map(Object.entries(store?.get<Record<string,Progress>>("progress",{}) ?? {}));
    this.cleanup = store?.get<number>("cleanup",0) ?? 0;
  }
  connect(id:string,name:string) { this.names.set(id,name); if(!this.profiles.has(id)) this.commit(id,fresh()); return this.profile(id); }
  profile(id:string):Progress { const profile=this.profiles.get(id); requireGame(profile,"UNKNOWN_PROFILE","เข้าเมืองก่อน"); return {...structuredClone(profile),water:profile.water??2,cozy:structuredClone(profile.cozy??cozyFresh()),village:structuredClone(profile.village??{xp:{},completed:[],museum:[]})}; }
  private commit(id:string,p:Progress) {
    if(this.activeReceipt?.id===id){p.receipts??={};p.receipts[this.activeReceipt.request]="คำสั่งนี้ยืนยันแล้ว";while(Object.keys(p.receipts).length>100)delete p.receipts[Object.keys(p.receipts)[0]];}
    const next=new Map(this.profiles); next.set(id,structuredClone(p)); this.store?.set("progress",Object.fromEntries(next)); this.profiles=next;
  }
  travel(id:string,map:MapId) { const p=this.profile(id); p.map=map; this.commit(id,p); this.leaveCafe(id); this.leaveBoat(id); }
  view(id:string,map:MapId):WorldView {
    const progress=this.profile(id);delete progress.receipts;
    return {map,serverTime:this.now(),progress,community:this.cozy.view(progress),homes:map==='town'?[...this.names].filter(([other])=>other===id||this.profile(other).cozy!.home.open).map(([other,name])=>({id:other,name,home:this.profile(other).cozy!.home})):[],farms:map==="farm"?[...this.names].map(([id,name])=> {
      const p=this.profile(id); return {id,name,allowHelp:p.allowHelp,plots:p.plots};
    }):[],cafe:structuredClone(this.cafe),boat:structuredClone(this.boat),cleanup:this.cleanup};
  }
  action(actor:WorldActor,raw:unknown,weather:string,wildlife?:ReadonlyMap<string,WildlifeView>):{notice:string;activity?:string;note?:number} {
    try{return this.processAction(actor,raw,weather,wildlife);}finally{this.activeReceipt=undefined;}
  }
  private processAction(actor:WorldActor,raw:unknown,weather:string,wildlife?:ReadonlyMap<string,WildlifeView>):{notice:string;activity?:string;note?:number} {
    requireGame(!actor.inCasino,"IN_CASINO","ออกจากโต๊ะก่อนทำกิจกรรม");
    const msg=objectPayload(raw), request=msg.requestId;
    requireGame(typeof request==="string"&&/^[a-zA-Z0-9-]{8,80}$/.test(request),"BAD_REQUEST","รหัสคำสั่งไม่ถูกต้อง");
    const done=this.seen.get(actor.id)??new Map<string,string>();
    const old=done.get(request); if(old) return {notice:old};
    const persisted=this.profile(actor.id).receipts?.[request];if(persisted)return{notice:persisted};
    this.activeReceipt={id:actor.id,request};
    const p=this.profile(actor.id); let notice="",activity: string|undefined,note:number|undefined;
    const verb=String(msg.verb??"");
    if(verb==="equip") {
      const cosmetic=String(msg.cosmeticId); requireGame(p.unlocks.includes(cosmetic),"LOCKED_ITEM","ยังไม่ได้ปลดล็อกชุดนี้");
      p.equipped=cosmetic; this.commit(actor.id,p); notice="เปลี่ยนชุดตกแต่งแล้ว";
    } else {
      let node:WorldNode|undefined;
      if(verb==='catch'){
        const id=typeof msg.wildlifeId==='string'?msg.wildlifeId:'';
        const animal=wildlife?.get(id),bug=animal&&CATCHABLE_BUGS[animal.kind];
        requireGame(animal&&bug,"BAD_WILDLIFE","แมลงตัวนี้ไม่มีอยู่หรือจับไม่ได้");
        requireGame(actor.map==='town'||!worldBlocked(actor.map,animal.x,animal.y),'BAD_WILDLIFE','แมลงไม่อยู่ในจุดนี้');
        node={id:wildlifeCatchKey(actor.map,id),map:actor.map,x:animal.x,y:animal.y,kind:'bug',name:bug.name,item:bug.item};
      }else node=WORLD_NODES.find(node=>node.id===msg.nodeId);
      requireGame(node&&node.map===actor.map,"WRONG_MAP","กิจกรรมนี้อยู่ในแมพอื่น");
      const plot=verb==='allow-help'?FARM_PLOTS.find(p=>p.nodeId===node!.id&&Math.hypot(actor.x-p.x,actor.y-p.y)<=100):['plant','water','harvest'].includes(verb)?FARM_PLOTS.find(p=>p.slot===msg.slot&&p.nodeId===node!.id):undefined;
      requireGame(Math.hypot(actor.x-node.x,actor.y-node.y)<=100||!!plot&&Math.hypot(actor.x-plot.x,actor.y-plot.y)<=100,"TOO_FAR","เดินเข้าใกล้จุดกิจกรรมก่อน");
      if(verb==='cook'||verb.startsWith('home-')||verb==='project-contribute'||verb.startsWith('picnic-')||verb==='festival-claim'){
        notice=this.cozy.action(actor.id,p,node,verb,msg,cost=>this.consumeMaterials(actor.id,p,cost),(item,n)=>this.add(p,item,n));this.commit(actor.id,p);
      }else if(verb==='order-submit'||verb==='museum-donate'){
        requireGame(msg.confirmed===true,'CONFIRM_REQUIRED','ตรวจรายการและยืนยันก่อนส่งของ');
        if(verb==='order-submit'){
          requireGame(node.kind==='orders','BAD_ACTION','ไปที่กระดานออร์เดอร์ก่อน');
          const order=VILLAGE_ORDERS.find(o=>o.id===msg.orderId);requireGame(order,'BAD_ORDER','ไม่มีออร์เดอร์นี้');
          requireGame(this.now()>=(p.cooldowns['order:'+order.id]??0),'COOLDOWN','ออร์เดอร์นี้ส่งแล้ว รอรอบถัดไป');
          this.consumeMaterials(actor.id,p,order.cost as Record<string,number>);
          p.village!.xp[order.skill]=Math.min(1000000,(p.village!.xp[order.skill]??0)+order.xp);
          if(!p.village!.completed.includes(order.id)){p.village!.completed.push(order.id);if(order.reward&&!p.unlocks.includes(order.reward))p.unlocks.push(order.reward);}
          p.cooldowns['order:'+order.id]=this.now()+ORDER_COOLDOWN;this.commit(actor.id,p);notice='ส่งออร์เดอร์สำเร็จ · ความชำนาญ +'+order.xp;
        }else{
          requireGame(node.kind==='museum','BAD_ACTION','ไปที่หอสะสมธรรมชาติก่อน');
          const item=String(msg.itemId),fish=FISH_SPECIES.some(f=>f.id===item);
          requireGame(fish||['bee','ladybug','beetle','butterfly','firefly'].includes(item),'BAD_ITEM','รับเฉพาะปลาและแมลง');
          requireGame(!p.village!.museum.includes(item),'ALREADY_DONATED','เคยมอบชนิดนี้แล้ว ไม่ต้องส่งซ้ำ');
          this.consumeMaterials(actor.id,p,{[item]:1});p.village!.museum.push(item);const skill=fish?'fishing':'nature';p.village!.xp[skill]=Math.min(1000000,(p.village!.xp[skill]??0)+5);
          if(p.village!.museum.length>=5&&!p.unlocks.includes('cat-hat'))p.unlocks.push('cat-hat');this.commit(actor.id,p);notice='มอบตัวอย่างสำเร็จ · บันทึกจัดแสดงถาวร · ความชำนาญ +5';
        }
      }else if(verb==="refill") {
        requireGame(node.kind==="water","BAD_ACTION","ไปที่จุดตักน้ำก่อน");
        requireGame(this.now()>=(p.cooldowns.refill??0),"COOLDOWN","รอตักน้ำสักครู่");
        requireGame((p.water??2)<999999,"INVENTORY_FULL","น้ำเต็มแล้ว");
        p.water=(p.water??2)+1;p.cooldowns.refill=this.now()+800;
        this.commit(actor.id,p);notice="ตักน้ำ +1 · มีน้ำ "+p.water+" หน่วย";
      } else if(verb==="collect"||verb==='catch') {
        requireGame(["bug","mushroom","rare","shell","treasure","cleanup"].includes(node.kind),"BAD_ACTION","จุดนี้เก็บไม่ได้");
        requireGame(this.now()>=(p.cooldowns[node.id]??0),"COOLDOWN","จุดนี้กำลังฟื้นตัว รอสักครู่");
        if(node.id==="bug-firefly") requireGame(Math.floor(this.now()/300000)%4>=2,"WRONG_TIME","หิ่งห้อยออกตอนเย็นและกลางคืน");
        if(node.kind==="rare") requireGame(weather==="snow","WRONG_WEATHER","กระต่ายหิมะจะมาเมื่อหิมะตก");
        this.add(p,node.item!,1); p.cooldowns[node.id]=this.now()+(node.kind==="treasure"?300000:node.kind==="rare"?120000:45000);
        this.skill(p,['bug','mushroom','rare'].includes(node.kind)?'nature':'explore',2);
        this.commit(actor.id,p); notice=node.kind==="rare"?"บันทึกสัตว์หายากแล้ว!":node.name+"สำเร็จ +1";
        if(node.kind==="cleanup") { this.cleanup++; this.store?.set("cleanup",this.cleanup); }
      } else if(verb==="plant"||verb==="water"||verb==="harvest"||verb==="allow-help") {
        requireGame(node.kind==="farm"||node.kind==="greenhouse","BAD_ACTION","ไปที่แปลงหรือโรงเรือนก่อน");
        const owner=typeof msg.ownerId==="string"?msg.ownerId:actor.id;
        const target=owner===actor.id?p:this.profile(owner);
        if(verb==="allow-help") {
          requireGame(owner===actor.id&&typeof msg.allow==="boolean","NOT_OWNER","ตั้งสิทธิ์ได้เฉพาะเจ้าของ");
          p.allowHelp=msg.allow; this.commit(actor.id,p); notice=p.allowHelp?"เปิดให้เพื่อนช่วยรดน้ำ":"ปิดการช่วยรดน้ำ";
        } else {
          const slot=msg.slot;
          requireGame(typeof slot==="number"&&Number.isInteger(slot)&&slot>=0&&slot<6,"BAD_SLOT","ช่องแปลงไม่ถูกต้อง");
          requireGame((node.kind==="greenhouse") === (slot>=4),"WRONG_PLOT","เข้าใกล้แปลงหรือโรงเรือนให้ถูกจุด");
          const crop=target.plots[slot];
          if(verb==="water") {
            requireGame(owner===actor.id||target.allowHelp,"NO_PERMISSION","เจ้าของยังไม่อนุญาตให้ช่วยรดน้ำ");
            requireGame(crop&&!crop.watered,"NO_CROP","ไม่มีผักที่ต้องรดน้ำ");
            requireGame((p.water??2)>0,"NO_WATER","น้ำหมดแล้ว ไปตักน้ำที่บ่อน้ำในฟาร์ม");
            p.water=(p.water??2)-1;crop.watered=true;
            if(owner!==actor.id)this.commit(actor.id,p);
            notice="รดน้ำแล้ว · น้ำคงเหลือ "+p.water+" หน่วย";
          } else {
            requireGame(owner===actor.id,"NOT_OWNER","เก็บเกี่ยวและปลูกได้เฉพาะเจ้าของ");
            if(verb==="plant") {
              const seed=SEEDS.find(seed=>seed.id===msg.seed); requireGame(seed&&!crop,"BAD_SEED","เลือกเมล็ดและช่องว่าง");
              target.plots[slot]={seed:seed.id as SeedId,plantedAt:this.now(),readyAt:this.now()+seed.growMs,watered:false}; notice="ปลูก"+seed.name+"แล้ว";
            } else {
              requireGame(crop&&crop.watered&&this.now()>=crop.readyAt,"NOT_READY","รอให้ผักโตและรดน้ำก่อน");
              this.add(target,crop.seed,1);this.skill(target,'garden',3); target.plots[slot]=null; notice="เก็บผลผลิต +1 · ทำสวน +3 XP";
            }
          }
          this.commit(owner,target);
        }
      } else if(verb==="feed") {
        requireGame(node.kind==="animal","BAD_ACTION","ไปสวนสัตว์ก่อน"); requireGame(this.now()>=(p.cooldowns.feed??0),"COOLDOWN","สัตว์ยังอิ่มอยู่ รอสักครู่");
        this.add(p,"animal-friend",1); p.cooldowns.feed=this.now()+60000; this.commit(actor.id,p); notice="สัตว์ดีใจ ได้บันทึกเพื่อนสัตว์ +1";activity="feed";
      } else if(verb==="sit") {
        requireGame(node.kind==="camp","BAD_ACTION","ไปที่แคมป์ก่อน");
        if(!p.discovered.includes("camper")) { this.add(p,"camper",1);this.commit(actor.id,p); }
        notice="นั่งพักข้างกองไฟ · คลิกพื้นเพื่อลุก";activity="camp";
      } else if(verb==="exchange") {
        requireGame(node.kind==="shop","BAD_ACTION","ไปที่ร้านแลกชุดก่อน");
        const cosmetic=COSMETICS.find(c=>c.id===msg.cosmeticId);
        requireGame(cosmetic&&!p.unlocks.includes(cosmetic.id),"BAD_ITEM","ชุดนี้ปลดล็อกแล้วหรือไม่มีในร้าน");
        for(const [item,count] of Object.entries(cosmetic.cost)) requireGame((p.inventory[item]??0)>=(count as number),"MISSING_ITEMS","ของสะสมสำหรับแลกยังไม่พอ");
        for(const [item,count] of Object.entries(cosmetic.cost)) p.inventory[item]-=count as number;
        p.unlocks.push(cosmetic.id); p.equipped=cosmetic.id; this.commit(actor.id,p);notice="ปลดล็อก "+cosmetic.name+" แล้ว!";
      } else if(verb.startsWith("cafe-")) {
        requireGame(node.kind==="cafe","BAD_ACTION","ไปหน้าคาเฟ่ก่อน"); notice=this.cafeAction(actor,verb,msg);
      } else if(verb==="boat") {
        requireGame(node.kind==="boat","BAD_ACTION","ไปที่ท่าเรือก่อน"); requireGame(!this.boat||this.now()<this.boat.departAt,"BOAT_AWAY","เรือกำลังเดินทาง รอเรือกลับ");
        if(!this.boat) this.boat={departAt:this.now()+4000,returnAt:this.now()+24000,members:[]};
        requireGame(this.boat.members.length<4&&!this.boat.members.includes(actor.id),"BOAT_FULL","เรือเต็มหรือคุณขึ้นแล้ว");
        this.boat.members.push(actor.id);notice="ขึ้นเรือแล้ว · รอออกพร้อมเพื่อน";activity="boat";
      } else if(verb==="note") {
        requireGame(node.kind==="stage","BAD_ACTION","ไปหน้าเวทีก่อน");
        requireGame(typeof msg.note==="number"&&Number.isInteger(msg.note)&&msg.note>=0&&msg.note<=7,"BAD_NOTE","โน้ตไม่ถูกต้อง");
        requireGame(this.now()-(this.musicRate.get(actor.id)??-Infinity)>=250,"COOLDOWN","เล่นทีละโน้ต");
        this.musicRate.set(actor.id,this.now());note=msg.note;activity="music";notice="เล่นโน้ตแล้ว";
        if(!p.discovered.includes("musician")) {this.add(p,"musician",1);this.commit(actor.id,p);}
      } else requireGame(false,"BAD_ACTION","ไม่รู้จักกิจกรรมนี้");
    }
    done.set(request,notice); if(done.size>100)done.delete(done.keys().next().value!);this.seen.set(actor.id,done);
    if(verb!=="note") {const latest=this.profile(actor.id);latest.receipts??={};latest.receipts[request]=notice;this.activeReceipt=undefined;this.commit(actor.id,latest);}
    return {notice,activity,note};
  }
  private add(p:Progress,item:string,count:number) {
    const next=(p.inventory[item]??0)+count;requireGame(Number.isSafeInteger(next)&&next<=999999,"INVENTORY_FULL","กระเป๋าเต็ม");
    p.inventory[item]=next;if(!p.discovered.includes(item))p.discovered.push(item);
  }
  private skill(p:Progress,skill:string,xp:number){p.village??={xp:{},completed:[],museum:[]};p.village.xp[skill]=Math.min(1000000,(p.village.xp[skill]??0)+xp);}
  /** Internal successful-reel hook; no client message can claim arbitrary XP. */
  recordFishing(id:string){const p=this.profile(id);this.skill(p,'fishing',3);this.commit(id,p);}
  private consumeMaterials(id:string,p:Progress,cost:Record<string,number>){
    const fish=this.fishing?.holdings(id)??{},fishCost:Record<string,number>={};
    for(const [item,n]of Object.entries(cost)){
      const isFish=FISH_SPECIES.some(f=>f.id===item);const count=isFish?(fish as Record<string,number>)[item]??0:p.inventory[item]??0;
      requireGame(Number.isSafeInteger(n)&&n>0&&count>=n,'MISSING_ITEMS','วัตถุดิบไม่พอ กรุณาตรวจของในกระเป๋า');if(isFish)fishCost[item]=n;
    }
    // All ingredients are checked first; caller runs this inside the existing durable batch.
    if(Object.keys(fishCost).length)this.fishing!.consume(id,fishCost);
    for(const [item,n]of Object.entries(cost)){if(!p.discovered.includes(item))p.discovered.push(item);if(!Object.prototype.hasOwnProperty.call(fishCost,item))p.inventory[item]-=n;}
  }
  private cafeAction(actor:WorldActor,verb:string,msg:Record<string,unknown>) {
    const c=this.cafe, member=c.members.find(m=>m.id===actor.id);
    if(verb==="cafe-join") {
      requireGame(c.phase==="lobby"&&!member&&c.members.length<4,"CAFE_FULL","รอรอบใหม่หรือห้องเต็ม");
      c.members.push({id:actor.id,name:actor.name,actions:0});c.host??=actor.id;return "เข้าทีมทำอาหารแล้ว";
    }
    if(verb==="cafe-leave") {this.leaveCafe(actor.id);return "ออกจากทีมแล้ว";}
    requireGame(member,"NOT_IN_CAFE","เข้าทีมก่อน");
    if(verb==="cafe-start") {
      requireGame(c.host===actor.id&&c.phase==="lobby"&&c.members.length>=2,"WAIT_TEAM","เจ้าของทีมเริ่มได้เมื่อมี 2–4 คน");
      if(msg.recipe==="soup") requireGame(this.profile(actor.id).discovered.includes("carrot"),"RECIPE_LOCKED","เก็บแครอทเพื่อปลดล็อกซุป");
      c.phase="running";c.deadline=this.now()+120000;c.roundId=randomUUID();c.recipe=msg.recipe==="soup"?"ซุปแครอท":"สลัดสวน";return "เริ่มครัว! ช่วยกันรับ เตรียม ปรุง และเสิร์ฟ";
    }
    if(verb==="cafe-reset") {
      requireGame(c.phase==="result"&&c.host===actor.id,"BAD_PHASE","รอผลก่อน");
      this.cafe={...cafeFresh(),members:c.members.map(m=>({...m,actions:0})),host:c.host};return "พร้อมเริ่มรอบใหม่";
    }
    requireGame(verb==="cafe-work"&&c.phase==="running"&&this.now()<c.deadline!,"BAD_PHASE","ครัวยังไม่เริ่มหรือจบรอบแล้ว");
    requireGame(msg.roundId===c.roundId,"STALE_ROUND","คำสั่งจากรอบเก่า");requireGame(msg.station===c.order,"WRONG_STATION","ทำตามลำดับ รับ → เตรียม → ปรุง → เสิร์ฟ");
    requireGame(this.now()-(this.musicRate.get("cafe:"+actor.id)??-Infinity)>=800,"COOLDOWN","รอจังหวะทำอาหาร");
    this.musicRate.set("cafe:"+actor.id,this.now());member.actions++;c.order++;
    if(c.order===4){c.order=0;c.served++;if(c.served>=3)this.finishCafe();}
    return ["รับออร์เดอร์แล้ว","เตรียมวัตถุดิบแล้ว","ปรุงแล้ว","เสิร์ฟแล้ว"][Number(msg.station)];
  }
  private finishCafe() {
    const c=this.cafe;if(c.phase!=="running")return;c.phase="result";c.deadline=null;
    if(c.served>=3) for(const m of c.members) if(m.actions>0) {const p=this.profile(m.id);this.add(p,"chef",1);this.commit(m.id,p);}
  }
  tick() {
    if(this.cafe.phase==="running"&&this.now()>=this.cafe.deadline!)this.finishCafe();
    if(this.boat&&this.now()>=this.boat.returnAt) {
      const members=[...this.boat.members];this.boat=null;
      for(const id of members){const p=this.profile(id);if(!p.discovered.includes("voyager")){this.add(p,"voyager",1);this.commit(id,p);}}
      return members;
    }
    return [];
  }
  boatFor(id:string) {return this.boat?.members.includes(id)?structuredClone(this.boat):null;}
  private leaveBoat(id:string) { if(this.boat){this.boat.members=this.boat.members.filter(m=>m!==id);if(!this.boat.members.length)this.boat=null;} }
  leaveCafe(id:string) {
    this.cafe.members=this.cafe.members.filter(m=>m.id!==id);if(this.cafe.host===id)this.cafe.host=this.cafe.members[0]?.id??null;
    if(!this.cafe.members.length)this.cafe=cafeFresh();
  }
  disconnect(id:string) { this.names.delete(id);this.leaveCafe(id);this.leaveBoat(id);this.seen.delete(id); }
}
