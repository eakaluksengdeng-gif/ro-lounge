import {GEAR_CATALOGUE,GEAR_SLOTS,SLOT_NAMES,equipmentFor,type GearSlot} from '../../../shared/equipment';
import type {Progress} from '../../../shared/regions';
import {renderCharacterCanvas,type Dir,type Look} from '../art';
import {itemCanvas} from './Cosmetics';
import {equipmentCanvas} from './EquipmentArt';
import './wardrobe.css';
const text=(value:string,cls='')=>{const p=document.createElement('p');p.textContent=value;p.className=cls;return p;};
const button=(label:string,run:()=>void,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=run;return b;};
export class WardrobeUI {
 private filter='all';private selected='';private angle=0;
 render(body:HTMLElement,p:Progress,look:Look,name:string,pending:boolean,send:(verb:string,payload:Record<string,unknown>)=>void,refresh:()=>void){
  const equipment=equipmentFor(p),owned=GEAR_CATALOGUE.filter(g=>p.unlocks.includes(g.id)),section=document.createElement('section');section.className='wardrobe';section.setAttribute('aria-label','ตัวละครและอุปกรณ์');
  const heading=document.createElement('header');heading.append(text('ตัวละครและอุปกรณ์','wardrobe-title'),text(owned.length+' ชิ้น · แฟชั่น ไม่มีค่าสเตตัส'));section.append(heading);
  const layout=document.createElement('div');layout.className='wardrobe-layout';
  const closet=document.createElement('div');closet.className='wardrobe-closet';const tabs=document.createElement('nav');tabs.className='wardrobe-tabs';
  for(const [id,label]of [['all','ทั้งหมด'],...GEAR_SLOTS.map(slot=>[slot,SLOT_NAMES[slot]])]){const b=button(label,()=>{this.filter=id;this.selected='';refresh();});b.setAttribute('aria-pressed',String(this.filter===id));tabs.append(b);}closet.append(tabs);
  const grid=document.createElement('div');grid.className='wardrobe-items';
  for(const item of owned.filter(g=>this.filter==='all'||g.slot===this.filter)){const b=button(item.name,()=>{this.selected=item.id;refresh();});b.className='wardrobe-item';b.dataset.gear=item.id;b.setAttribute('aria-pressed',String(item.id===this.selected));b.prepend(itemCanvas(item.id));if(equipment[item.slot]===item.id)b.append(text('ใส่อยู่ ✓','wardrobe-equipped'));grid.append(b);}if(!grid.children.length)grid.append(text('ยังไม่มีอุปกรณ์หมวดนี้ · รับจากออร์เดอร์หรือร้านชุด'));closet.append(grid);
  const stage=document.createElement('div');stage.className='wardrobe-stage';stage.append(text(name||'ตัวละครของฉัน','wardrobe-name'));
  const dir:Dir=this.angle===0?'down':this.angle===2?'up':'side',base=renderCharacterCanvas(look,dir,0),canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;if(this.angle===3){c.translate(48,0);c.scale(-1,1);}c.drawImage(base,0,0);c.drawImage(equipmentCanvas(equipment,dir),0,0);canvas.className='wardrobe-avatar';canvas.setAttribute('aria-label','ตัวละครพร้อมอุปกรณ์ที่ใส่จริง');stage.append(canvas);
  const rotate=document.createElement('div');rotate.className='wardrobe-rotate';rotate.append(button('↶ หมุนซ้าย',()=>{this.angle=(this.angle+3)%4;refresh();}),button('หมุนขวา ↷',()=>{this.angle=(this.angle+1)%4;refresh();}));stage.append(rotate);
  const slots=document.createElement('div');slots.className='wardrobe-slots';
  for(const slot of GEAR_SLOTS){const item=GEAR_CATALOGUE.find(g=>g.id===equipment[slot]),b=button(SLOT_NAMES[slot]+(item?' · '+item.name:' · ว่าง'),()=>{this.filter=slot;this.selected=item?.id??'';refresh();});b.dataset.slot=slot;b.className='wardrobe-slot';const icon=itemCanvas(item?.id??({head:'camp-hat',body:'linen-apron',held:'butterfly-net',hands:'garden-gloves',feet:'woodland-boots'} as Record<GearSlot,string>)[slot]);if(!item)icon.dataset.empty='true';b.prepend(icon);slots.append(b);}
  layout.append(closet,stage,slots);section.append(layout);
  const selected=owned.find(g=>g.id===this.selected)??owned.find(g=>this.filter==='all'||g.slot===this.filter),detail=document.createElement('aside');detail.className='wardrobe-detail';
  if(selected){this.selected=selected.id;const equipped=equipment[selected.slot]===selected.id;detail.append(itemCanvas(selected.id),text(selected.name,'wardrobe-title'),text(SLOT_NAMES[selected.slot]+' · '+(selected.quest?'รางวัลออร์เดอร์ · เป็นเจ้าของถาวร':'เครื่องแต่งกายที่เป็นเจ้าของแล้ว')),button(equipped?'ถอดอุปกรณ์':'สวมใส่',()=>send('equip-slot',{slot:selected.slot,itemId:equipped?'none':selected.id}),pending));}
  else detail.append(text('ทำออร์เดอร์สำเร็จแล้ว อุปกรณ์จะเข้าคลังนี้ · ไม่ปนกับจำนวนวัตถุดิบในกระเป๋า'));
  section.append(detail);body.append(section);
 }
}
