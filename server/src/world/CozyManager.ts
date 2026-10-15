import {randomUUID} from 'node:crypto';
import {RECIPES,FURNITURE,TOWN_PROJECTS,FESTIVAL_GOAL,festivalWeek,cozyFresh,type CommunityView,type PicnicView} from '../../../shared/cozy';
import type {Progress,WorldNode} from '../../../shared/regions';
import type {SnapshotStore} from '../storage/SnapshotStore';
import {requireGame} from '../pokdeng/errors';

/** Called only after WorldManager validates actor, node, distance and receipt. */
export class CozyManager {
  private projects:Record<string,number>;
  private picnic:PicnicView|null;
  private picnics:Record<string,PicnicView>;
  constructor(private store:SnapshotStore|undefined,private now:()=>number){
    this.projects=store?.get('townProjects',{})??{};
    this.picnic=store?.get<PicnicView|null>('picnic',null)??null;
    this.picnics=store?.get<Record<string,PicnicView>>('picnicSessions',{})??{};
    if(this.picnic)this.picnic=this.picnics[this.picnic.id]??this.picnic;
  }
  view(p:Progress):CommunityView{const picnic=(p.cozy?.picnicId&&this.picnics[p.cozy.picnicId])||this.picnic;return{projects:{...this.projects},contributions:{...p.cozyContributions},picnic:picnic?structuredClone(picnic):null,week:festivalWeek(this.now())};}
  private points(p:Progress,n:number){const c=p.cozy??=cozyFresh(),week=festivalWeek(this.now());if(c.festival.week!==week)c.festival={week,points:0,claimed:false};c.festival.points=Math.min(1000,c.festival.points+n);}
  action(id:string,p:Progress,node:WorldNode,verb:string,msg:Record<string,unknown>,consume:(cost:Record<string,number>)=>void,add:(item:string,n:number)=>void):string{
    const c=p.cozy??=cozyFresh();
    requireGame(msg.confirmed===true,'CONFIRM_REQUIRED','ตรวจรายการและยืนยันก่อนทำกิจกรรม');
    if(verb==='cook'){
      requireGame(node.kind==='cafe','BAD_ACTION','ไปที่คาเฟ่ก่อน');
      const recipe=RECIPES.find(r=>r.id===msg.recipeId);requireGame(recipe,'BAD_RECIPE','ไม่มีสูตรนี้');
      requireGame(this.now()>=(p.cooldowns.cook??0),'COOLDOWN','รอให้ครัวพร้อมก่อน');
      requireGame((p.inventory[recipe.id]??0)<999999,'INVENTORY_FULL','อาหารเต็มแล้ว');
      consume(recipe.cost as Record<string,number>);add(recipe.id,1);p.cooldowns.cook=this.now()+3000;
      p.village!.xp.garden=Math.min(1000000,(p.village!.xp.garden??0)+recipe.xp);this.points(p,1);
      return 'ปรุง'+recipe.name+' +1 · เก็บในกระเป๋า นำไปปิกนิกได้';
    }
    if(verb.startsWith('home-')){
      requireGame(node.kind==='home','BAD_ACTION','ไปที่บ้านและเวิร์กช็อปก่อน');
      const home=c.home;
      if(verb==='home-access'){requireGame(typeof msg.open==='boolean','BAD_ACCESS','สิทธิ์ไม่ถูกต้อง');home.open=msg.open;return home.open?'เปิดบ้านให้เพื่อนเยี่ยมชม':'ปิดการเยี่ยมชมแล้ว';}
      if(verb==='home-craft'){
        const item=FURNITURE.find(f=>f.id===msg.itemId);requireGame(item&&item.cost,'BAD_FURNITURE','ของชิ้นนี้สร้างไม่ได้');
        requireGame((home.owned[item.id]??0)<20,'HOME_FULL','เฟอร์นิเจอร์ชนิดนี้ครบ 20 ชิ้นแล้ว');consume(item.cost as Record<string,number>);home.owned[item.id]=(home.owned[item.id]??0)+1;this.points(p,1);return 'สร้าง'+item.name+'แล้ว · วางในบ้านได้';
      }
      const index=home.placements.findIndex(f=>f.uid===msg.uid);
      if(verb==='home-remove'){requireGame(index>=0,'BAD_FURNITURE','ไม่พบของชิ้นนี้ในบ้านคุณ');home.placements.splice(index,1);return 'เก็บเฟอร์นิเจอร์แล้ว · ของยังเป็นของคุณ';}
      requireGame(verb==='home-place','BAD_ACTION','ไม่รู้จักคำสั่งบ้าน');
      const item=FURNITURE.find(f=>f.id===msg.itemId);requireGame(item,'BAD_FURNITURE','ไม่มีเฟอร์นิเจอร์นี้');
      const {x,y,rotation}=msg;
      requireGame(typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<8&&typeof y==='number'&&Number.isInteger(y)&&y>=0&&y<6&&typeof rotation==='number'&&Number.isInteger(rotation)&&rotation>=0&&rotation<4,'BAD_PLACEMENT','ตำแหน่งหรือทิศทางไม่ถูกต้อง');
      requireGame(!home.placements.some(f=>f.x===x&&f.y===y),'OCCUPIED','ช่องนี้มีของแล้ว');
      requireGame(home.placements.filter(f=>f.item===item.id).length<(home.owned[item.id]??0),'NOT_OWNED','ไม่มีของเหลือให้วาง');
      home.placements.push({uid:randomUUID(),item:item.id,x,y,rotation});return 'จัดบ้านแล้ว';
    }
    requireGame(node.kind==='community','BAD_ACTION','ไปที่ลานชุมชนก่อน');
    if(verb==='project-contribute'){
      const project=TOWN_PROJECTS.find(project=>project.id===msg.projectId);requireGame(project,'BAD_PROJECT','ไม่มีโครงการนี้');
      requireGame((this.projects[project.id]??0)<project.goal,'PROJECT_DONE','โครงการนี้สำเร็จแล้ว');
      const contributed=p.cozyContributions??={};requireGame((contributed[project.id]??0)<10,'CONTRIBUTION_CAP','คุณช่วยโครงการนี้ครบ 10 ชิ้นแล้ว ขอบคุณมาก');
      consume({[project.item]:1});contributed[project.id]=(contributed[project.id]??0)+1;this.projects[project.id]=(this.projects[project.id]??0)+1;this.store?.set('townProjects',this.projects);this.points(p,1);
      return this.projects[project.id]===project.goal?'โครงการสำเร็จ! ของตกแต่งชุมชนปลดล็อกแล้ว':'ช่วยโครงการ +1 · ไม่หักชิป';
    }
    if(verb==='festival-claim'){
      const f=c.festival;requireGame(f.week===festivalWeek(this.now())&&f.points>=FESTIVAL_GOAL&&!f.claimed,'NOT_READY','สะสมดาวสัปดาห์นี้ให้ครบ หรือรับแล้ว');
      f.claimed=true;
      // Permanent unique decoration: no unlimited stock or currency from weekly claims.
      c.home.owned['festival-lantern']=Math.max(1,c.home.owned['festival-lantern']??0);
      p.village!.xp.explore=Math.min(1000000,(p.village!.xp.explore??0)+20);return 'รับรางวัลเทศกาล · โคมไฟถาวร + สำรวจ 20 XP';
    }
    if(verb==='picnic-join'){
      requireGame(this.now()>=(p.cooldowns.picnic??0),'COOLDOWN','ปิกนิกให้รางวัลได้วันละครั้ง');
      requireGame(!c.picnicId||!this.picnics[c.picnicId],'UNCLAIMED_PICNIC','รับรางวัลปิกนิกเดิมก่อนเริ่มใหม่');
      requireGame(!this.picnic||this.now()>this.picnic.endsAt+60000||this.now()<this.picnic.endsAt,'PICNIC_RESULT','รอรอบปิกนิกใหม่');
      const active=this.picnic&&this.now()<this.picnic.endsAt?structuredClone(this.picnic):{id:randomUUID(),endsAt:this.now()+30000,members:[],claimed:[]};
      requireGame(active.members.length<8&&!active.members.includes(id),'PICNIC_FULL','เข้าร่วมแล้วหรือปิกนิกเต็ม');
      const recipe=RECIPES.find(r=>r.id===msg.foodId);requireGame(recipe,'BAD_FOOD','เลือกอาหารจริงในกระเป๋า');consume({[recipe.id]:1});active.members.push(id);this.picnic=active;this.picnics[active.id]=active;c.picnicId=active.id;this.savePicnics();return 'นำอาหารร่วมปิกนิกแล้ว · ครบเวลาแวะรับรางวัลได้แม้ออฟไลน์';
    }
    requireGame(verb==='picnic-claim','BAD_ACTION','ไม่รู้จักกิจกรรมนี้');
    const picnic=c.picnicId?this.picnics[c.picnicId]:undefined;requireGame(picnic&&picnic.id===msg.picnicId&&this.now()>=picnic.endsAt&&picnic.members.includes(id)&&!picnic.claimed.includes(id),'NOT_READY','ยังไม่ถึงเวลาหรือคุณรับรางวัลแล้ว');
    requireGame(this.now()>=(p.cooldowns.picnic??0),'COOLDOWN','รับรางวัลวันนี้แล้ว');
    const xp=picnic.members.length>=2?15:5;p.village!.xp.explore=Math.min(1000000,(p.village!.xp.explore??0)+xp);this.points(p,2);p.cooldowns.picnic=this.now()+86400000;
    picnic.claimed.push(id);delete c.picnicId;if(picnic.claimed.length===picnic.members.length){delete this.picnics[picnic.id];if(this.picnic?.id===picnic.id)this.picnic=null;}this.savePicnics();return 'ปิกนิกสำเร็จ · สำรวจ +'+xp+' XP · ดาวเทศกาล +2';
  }
  private savePicnics(){this.store?.set('picnic',this.picnic);this.store?.set('picnicSessions',this.picnics);}
}
