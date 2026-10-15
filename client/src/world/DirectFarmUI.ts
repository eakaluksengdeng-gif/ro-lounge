import {FARM_PLOTS,SEEDS,type WorldView} from '../../../shared/regions';
import type {TownScene} from '../scenes/TownScene';
import {itemCanvas} from './Cosmetics';
import './direct-farm.css';
type Send=(verb:string,payload:Record<string,unknown>)=>void;
/** A non-modal tool strip at the real crop, never a full-screen farm menu. */
export class DirectFarmUI {
 readonly root=document.createElement('section');private owner='';private signature='';private preferred=-1;private timeView?:WorldView;private receivedAt=0;
 constructor(private scene:TownScene,private send:Send){this.root.id='directFarm';this.root.hidden=true;this.root.setAttribute('aria-label','ดูแลแปลงตรงหน้า');document.body.append(this.root);}
 destroy(){this.root.remove();}
 select(slot:number){this.preferred=slot;this.signature='';}
 primary(){if(this.root.hidden)return false;const action=this.root.querySelector<HTMLButtonElement>('[data-primary]');if(action&&!action.disabled)action.click();else this.root.querySelector<HTMLButtonElement>('.farm-seeds button')?.focus();return true;}
 update(view:WorldView|undefined,p:any,blocked:boolean,pending:boolean){
  const near=p?.mapId==='farm'&&!blocked&&view?FARM_PLOTS.filter(plot=>Math.hypot(p.x-plot.x,p.y-plot.y)<=100):[];
  const plot=near.find(plot=>plot.slot===this.preferred)??near.sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
  this.root.hidden=!plot;if(!plot||!view){this.preferred=-1;return;}
  const mine=p.playerId;let farm=view.farms.find(f=>f.id===this.owner);if(!farm){this.owner=mine;farm=view.farms.find(f=>f.id===mine);}
  if(!farm){this.root.hidden=true;return;}
  this.scene.farmOwner=farm.id;
  if(view!==this.timeView){this.timeView=view;this.receivedAt=Date.now();}
  const crop=farm.plots[plot.slot],now=(view.serverTime??this.receivedAt)+Date.now()-this.receivedAt;
  const remaining=crop?Math.max(0,Math.ceil((crop.readyAt-now)/1000)):0;
  const cropLabel=crop?SEEDS.find(s=>s.id===crop.seed)!.name+' · '+(remaining?'อีก '+remaining+' วิ':'โตแล้ว')+(crop.watered?'':' · ต้องรดน้ำ'):'';
  const sig=JSON.stringify([plot.slot,farm.id,farm.allowHelp,crop,remaining>0,view.progress.water,pending,view.farms.map(f=>[f.id,f.name])]);
  const camera=this.scene.cameras?.main,canvas=this.scene.game?.canvas;
  if(camera&&canvas){const bounds=canvas.getBoundingClientRect(),x=bounds.left+(plot.x-camera.scrollX)*camera.zoom*bounds.width/this.scene.scale.width,y=bounds.top+(plot.y-camera.scrollY+30)*camera.zoom*bounds.height/this.scene.scale.height;this.root.style.left=Math.max(142,Math.min(innerWidth-142,x))+'px';this.root.style.top=Math.max(86,Math.min(innerHeight-240,y))+'px';}
  if(sig===this.signature){const status=this.root.querySelector('[data-growth]');if(status)status.textContent=cropLabel;return;}this.signature=sig;this.root.replaceChildren();this.root.dataset.slot=String(plot.slot);
  const button=(label:string,run:()=>void,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=pending||disabled;b.onclick=run;return b;};
  const send=(verb:string,extra:Record<string,unknown>={})=>this.send(verb,{nodeId:plot.nodeId,ownerId:farm!.id,slot:plot.slot,...extra});
  const header=document.createElement('header'),title=document.createElement('strong');title.textContent='แปลง '+(plot.slot+1)+' · 💧 '+(view.progress.water??2);header.append(title);
  const owners=document.createElement('select');owners.setAttribute('aria-label','แปลงของใคร');for(const f of view.farms){const option=document.createElement('option');option.value=f.id;option.textContent=f.id===mine?'ของฉัน':f.name;owners.append(option);}owners.value=farm.id;owners.disabled=pending;owners.onchange=()=>{this.owner=owners.value;this.signature='';};header.append(owners);this.root.append(header);
  if(farm.id===mine){const help=button(farm.allowHelp?'เพื่อนช่วยรดน้ำ: เปิด':'เพื่อนช่วยรดน้ำ: ปิด',()=>send('allow-help',{allow:!farm!.allowHelp}));help.className='farm-help';this.root.append(help);}
  if(!crop){const seeds=document.createElement('div');seeds.className='farm-seeds';for(const seed of SEEDS){const b=button('ปลูก'+seed.name,()=>send('plant',{seed:seed.id}),farm.id!==mine);b.prepend(itemCanvas(seed.id));seeds.append(b);}this.root.append(seeds);return;}
  const status=document.createElement('p');status.textContent=cropLabel;status.dataset.growth='true';this.root.append(status);
  const action=!crop.watered?button('💧 รดน้ำ −1 · E',()=>send('water'),(view.progress.water??2)<=0||farm.id!==mine&&!farm.allowHelp):button(remaining?'กำลังโต…':'เก็บเกี่ยว · E',()=>send('harvest'),remaining>0||farm.id!==mine);
  action.dataset.primary='true';this.root.append(action);
  if(!crop.watered&&(view.progress.water??2)<=0){const hint=document.createElement('small');hint.textContent='น้ำหมด · ไปตักน้ำที่บ่อในฟาร์ม';this.root.append(hint);}
 }
}
