import {FURNITURE,RECIPES,TOWN_PROJECTS,FESTIVAL_GOAL,cozyFresh,type HomeState} from '../../../shared/cozy';
import {ITEMS,type WorldView} from '../../../shared/regions';
import {FISH_SPECIES} from '../../../shared/nature';
import {itemCanvas} from './Cosmetics';
import {artCanvas} from '../reference/Assets';
import './cozy.css';

const text=(value:string,cls='')=>{const p=document.createElement('p');p.textContent=value;p.className=cls;return p;};
const button=(label:string,run:()=>void,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=run;return b;};
export function furnitureCanvas(id:string){
 return artCanvas('furniture-'+id,96);
}
type Send=(verb:string,payload?:Record<string,unknown>)=>void;
export class CozyUI {
 private tab='';private selected='forest-stool';private rotation=0;private visitor='';
 private confirmation?:{verb:string;payload:Record<string,unknown>;cost:Record<string,number>;label:string};
 reset(){this.confirmation=undefined;}
 render(page:string,view:WorldView,fish:Record<string,number>,body:HTMLElement,id:string,pending:boolean,send:Send,refresh:()=>void,avatar?:(id:string)=>HTMLElement|undefined){
  const c=view.progress.cozy??cozyFresh(),community=view.community,p=view.progress;
  const stock=(item:string)=>FISH_SPECIES.some(f=>f.id===item)?fish[item]??0:p.inventory[item]??0;
  const costRow=(cost:Record<string,number>)=>{const row=document.createElement('div');row.className='village-ingredients';for(const [item,n]of Object.entries(cost)){const cell=document.createElement('div');cell.dataset.enough=String(stock(item)>=n);cell.append(itemCanvas(item),text(ITEMS[item]?.name??FISH_SPECIES.find(f=>f.id===item)?.name??item),text(stock(item)+' / '+n));row.append(cell);}return row;};
  const ask=(verb:string,payload:Record<string,unknown>,cost:Record<string,number>,label:string)=>{this.confirmation={verb,payload,cost,label};refresh();};
  if(this.confirmation){const q=this.confirmation,card=document.createElement('section');card.className='village-confirmation';card.append(text(q.label,'world-card-title'),costRow(q.cost),text('หักเฉพาะของตามรายการจริง · ไม่ใช้ชิป · สมุดสะสมยังอยู่'),button('ยืนยัน',()=>{this.confirmation=undefined;send(q.verb,{...q.payload,confirmed:true});},pending||!Object.entries(q.cost).every(([item,n])=>stock(item)>=n)),button('ยกเลิก',()=>{this.confirmation=undefined;refresh();},pending));body.append(card);return;}
  if(page==='cooking'){
   body.append(text('ครัวส่วนตัว · ปรุงอาหารไว้จัดปิกนิก ใช้ของจริง ไม่ใช่ชิป','cozy-lead'));
   const kitchen=document.createElement('div');kitchen.className='cozy-kitchen-preview';const cook=avatar?.(id);if(cook)kitchen.append(cook);body.append(kitchen);
   const grid=document.createElement('div');grid.className='village-orders';
   for(const recipe of RECIPES){const card=document.createElement('article');card.dataset.recipe=recipe.id;card.append(itemCanvas(recipe.id),text(recipe.name,'world-card-title'),costRow(recipe.cost as Record<string,number>),text('ทำสวน +'+recipe.xp+' XP · ดาวเทศกาล +1 · ได้อาหาร 1 จาน'),button('ตรวจสูตรและปรุง',()=>ask('cook',{recipeId:recipe.id},recipe.cost as Record<string,number>,'ปรุง '+recipe.name),pending||Date.now()<(p.cooldowns.cook??0)||!Object.entries(recipe.cost).every(([item,n])=>stock(item)>=n)));grid.append(card);}body.append(grid);return;
  }
  if(page==='home'){
   const tabs=document.createElement('nav');tabs.className='cozy-tabs';for(const [key,label]of [['room','จัดบ้าน'],['craft','เวิร์กช็อป'],['visit','บ้านเพื่อน']])tabs.append(button(label,()=>{this.tab=key;refresh();}));body.append(tabs);
   if(this.tab==='craft'){
    const grid=document.createElement('div');grid.className='village-orders';for(const item of FURNITURE){const card=document.createElement('article');card.append(furnitureCanvas(item.id),text(item.name,'world-card-title'),text('เป็นเจ้าของ '+(c.home.owned[item.id]??0)+' ชิ้น'));if(item.cost)card.append(costRow(item.cost as Record<string,number>),button('ตรวจรายการสร้าง',()=>ask('home-craft',{itemId:item.id},item.cost as Record<string,number>,'สร้าง '+item.name),pending||(c.home.owned[item.id]??0)>=20||!Object.entries(item.cost).every(([item,n])=>stock(item)>=n)));else card.append(text('รางวัลดาวเทศกาล 10 ดวง'));grid.append(card);}body.append(grid);return;
   }
   if(this.tab==='visit'){
    const homes=(view.homes??[]).filter(h=>h.id!==id);body.append(text('เพื่อนออนไลน์ที่เปิดบ้าน · เยี่ยมชมได้ แต่ย้ายของเจ้าของไม่ได้'));
    const row=document.createElement('div');row.className='cozy-tabs';for(const home of homes)row.append(button('บ้าน '+home.name,()=>{this.visitor=home.id;refresh();}));body.append(row);const visit=homes.find(h=>h.id===this.visitor);if(visit)this.room(body,visit.home,true,pending,send);else body.append(text(homes.length?'เลือกบ้านเพื่อนที่อยากชม':'ยังไม่มีเพื่อนเปิดบ้านออนไลน์'));return;
   }
   body.append(text('บ้านของคุณ · เลือกเฟอร์นิเจอร์แล้วแตะช่องว่าง · แตะของที่วางเพื่อเก็บคืน','cozy-lead'));
   body.append(button(c.home.open?'ปิดบ้านให้เป็นส่วนตัว':'เปิดบ้านให้เพื่อนเยี่ยมชม',()=>send('home-access',{open:!c.home.open,confirmed:true}),pending));
   const available=FURNITURE.filter(item=>(c.home.owned[item.id]??0)>c.home.placements.filter(f=>f.item===item.id).length);if(!available.some(item=>item.id===this.selected))this.selected=available[0]?.id??'';
   const shelf=document.createElement('div');shelf.className='cozy-shelf';for(const item of FURNITURE){const left=(c.home.owned[item.id]??0)-c.home.placements.filter(f=>f.item===item.id).length;if(!c.home.owned[item.id])continue;const b=button(item.name+' · เหลือ '+left,()=>{this.selected=item.id;refresh();},pending||left<=0);b.setAttribute('aria-pressed',String(this.selected===item.id));b.prepend(furnitureCanvas(item.id));shelf.append(b);}body.append(shelf,button('หมุนเฟอร์นิเจอร์ ↻ '+this.rotation*90+'°',()=>{this.rotation=(this.rotation+1)%4;refresh();},pending));this.room(body,c.home,false,pending,send);return;
  }
  if(!community){body.append(text('กำลังโหลดชุมชน…'));return;}
  const tabs=document.createElement('nav');tabs.className='cozy-tabs';for(const [key,label]of [['projects','ช่วยสร้างเมือง'],['picnic','ปิกนิก'],['festival','เทศกาลรายสัปดาห์']])tabs.append(button(label,()=>{this.tab=key;refresh();}));body.append(tabs);
  if(this.tab==='picnic'){
   const picnic=community.picnic,member=picnic?.members.includes(id),done=picnic?.claimed.includes(id);
   const scene=document.createElement('div');scene.className='cozy-picnic';scene.append(furnitureCanvas('picnic-rug'),text('PICNIC TOGETHER','world-card-title'),text('นำอาหารคนละ 1 จาน · รอ 30 วินาที · 1–8 คน'));
   if(picnic){scene.append(text('เข้าร่วม '+picnic.members.length+' / 8 คน'));const people=document.createElement('div');people.className='cozy-picnic-people';for(const member of picnic.members){const person=avatar?.(member);if(person)people.append(person);else people.append(text(member===id?'คุณ':'เพื่อนร่วมปิกนิก'));}scene.append(people);const timer=text(Date.now()>=picnic.endsAt?'พร้อมรับรางวัล':'กำลังจัดโต๊ะ…');timer.dataset.readyAt=String(picnic.endsAt);scene.append(timer);}body.append(scene);
   body.append(text('เล่นคนเดียวได้สำรวจ +5 XP · มีเพื่อนร่วมอย่างน้อย 2 คนได้ +15 XP · ดาว +2 · รับรางวัลวันละครั้ง'));
   if(member&&!done){body.append(button('รับรางวัลปิกนิก',()=>send('picnic-claim',{picnicId:picnic!.id,confirmed:true}),pending||Date.now()<picnic!.endsAt));return;}
   if((p.cooldowns.picnic??0)>Date.now()){body.append(text('รับรางวัลวันนี้แล้ว · กลับมาใหม่หลังครบ 24 ชั่วโมง'));return;}
   const waiting=picnic&&Date.now()>=picnic.endsAt&&Date.now()<=picnic.endsAt+60000;
   for(const recipe of RECIPES)body.append(button('นำ '+recipe.name+' ร่วมปิกนิก · มี '+stock(recipe.id),()=>ask('picnic-join',{foodId:recipe.id},{[recipe.id]:1},'นำอาหารร่วมปิกนิก'),pending||stock(recipe.id)<1||!!waiting||!!picnic&&Date.now()<picnic.endsAt&&picnic.members.length>=8));if(waiting)body.append(text('กำลังสรุปรอบก่อนหน้า · รอบใหม่เปิดภายใน 1 นาที'));return;
  }
  if(this.tab==='festival'){
   const f=c.festival,current=f.week===community.week,points=current?f.points:0;body.append(text('เทศกาลอบอุ่นประจำสัปดาห์','cozy-lead'),text('ปรุงอาหาร สร้างเฟอร์นิเจอร์ หรือช่วยเมือง +1 ดาว · ปิกนิก +2 ดาว · ไม่ต้องแข่งอันดับ'));
   const meter=document.createElement('progress');meter.max=FESTIVAL_GOAL;meter.value=points;meter.setAttribute('aria-label','ดาวเทศกาล');body.append(meter,text('ดาว '+points+' / '+FESTIVAL_GOAL),furnitureCanvas('festival-lantern'),text('ครบ 10 ดาว: โคมไฟถาวร (ไม่แจกซ้ำ) + สำรวจ 20 XP · เริ่มสัปดาห์ใหม่ทุกวันพฤหัสบดี 07:00 ไทย'),button(current&&f.claimed?'รับรางวัลแล้ว':'รับรางวัลเทศกาล',()=>send('festival-claim',{confirmed:true}),pending||points<FESTIVAL_GOAL||current&&f.claimed));return;
  }
  body.append(text('ทุกคนช่วยได้ · บริจาคครั้งละ 1 ชิ้น สูงสุดคนละ 10 ชิ้นต่อโครงการ · เสร็จแล้วปลดล็อกของตกแต่งในแมพจริง','cozy-lead'));
  const grid=document.createElement('div');grid.className='village-orders';for(const project of TOWN_PROJECTS){const n=community.projects[project.id]??0,own=community.contributions[project.id]??0,card=document.createElement('article'),bar=document.createElement('progress');bar.max=project.goal;bar.value=n;card.dataset.project=project.id;card.append(text(project.name,'world-card-title'),bar,text(n+' / '+project.goal+' · คุณช่วยแล้ว '+own+' / 10'),costRow({[project.item]:1}),button(n>=project.goal?'สร้างสำเร็จแล้ว':'ตรวจรายการช่วยเมือง',()=>ask('project-contribute',{projectId:project.id},{[project.item]:1},'ช่วย '+project.name),pending||n>=project.goal||own>=10||stock(project.item)<1));grid.append(card);}body.append(grid);
 }
 private room(body:HTMLElement,home:HomeState,readonly:boolean,pending:boolean,send:Send){
  const room=document.createElement('div');room.className='cozy-home-room';room.setAttribute('aria-label',readonly?'บ้านเพื่อน':'จัดวางเฟอร์นิเจอร์ 8 คูณ 6 ช่อง');
  for(let y=0;y<6;y++)for(let x=0;x<8;x++){const placed=home.placements.find(p=>p.x===x&&p.y===y),item=FURNITURE.find(f=>f.id===placed?.item);const cell=button(placed?'':'＋',()=>placed?send('home-remove',{uid:placed.uid,confirmed:true}):send('home-place',{itemId:this.selected,x,y,rotation:this.rotation,confirmed:true}),pending||readonly||!placed&&!this.selected);cell.setAttribute('aria-label',(item?.name??'วางเฟอร์นิเจอร์')+' แถว '+(y+1)+' ช่อง '+(x+1));if(placed){const art=furnitureCanvas(placed.item);art.style.transform='rotate('+placed.rotation*90+'deg)';cell.append(art);cell.title=item?.name??placed.item;}room.append(cell);}const stage=document.createElement('div');stage.className='cozy-home-stage';stage.append(room);const scroll=document.createElement('div');scroll.className='cozy-home-scroll';scroll.setAttribute('aria-label','ห้องของคุณ เลื่อนซ้ายขวาได้บนมือถือ');scroll.append(stage);body.append(scroll);
 }
}
