import Phaser from "phaser";
import { MAP_NAMES,WORLD_NODES,destination,boatPosition,type Direction,type MapId,type WorldView } from "../../../shared/regions";
import { MAP_W,MAP_H } from "../world";
import { mulberry32 } from "../art";
import { buildNatureTextures } from "../nature/art";
import { artImage } from "../reference/Assets";
import { groundCanvas } from "../reference/WorldArt";
import {FARM_PLOTS} from '../../../shared/regions';
import {growthStage} from '../../../shared/growth';
const FONT='"Noto Sans Thai",Arial,sans-serif';
export class WorldRenderer {
  private motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  private movingSprites:{sprite:Phaser.GameObjects.Image;x:number;y:number;kind:string;id:string}[]=[];
  private crops:Phaser.GameObjects.Image[]=[];
  private boat?:Phaser.GameObjects.Image;
  private fire?:Phaser.GameObjects.Image;
  private water?:Phaser.GameObjects.Graphics;
  private watered=new Map<string,boolean>();private hasFarmView=false;private clockView?:WorldView;private receivedAt=0;
  private farmCat?:Phaser.GameObjects.Image;
  constructor(private scene:Phaser.Scene,private map:MapId){}
  private image(asset:string,x:number,y:number,w:number,h=w,foot=true){
    const key='ref-'+asset;if(!this.scene.textures.exists(key))this.scene.textures.addImage(key,artImage(asset));
    return this.scene.add.image(x,y,key).setDisplaySize(w,h).setOrigin(.5,foot?.94:.5).setDepth(y);
  }
  draw(){
    buildNatureTextures(this.scene);
    const key='reference-ground-'+this.map;if(!this.scene.textures.exists(key))this.scene.textures.addCanvas(key,groundCanvas(this.map));
    this.scene.add.image(0,0,key).setOrigin(0).setDepth(-1000);
    const rnd=mulberry32(37+this.map.length);
    const trees=this.map==='beach'?[[180,220],[1230,240]]:this.map==='market'?[[120,220],[1230,600],[200,700]]:[[160,200],[320,140],[1160,160],[1300,330],[170,570],[310,710],[1230,720],[1160,580],[400,280]];
    for(const [x,y]of trees)this.image('prop-'+(this.map==='beach'?'palm':this.map==='forest'?'pine':'oak'),x,y,150,165);
    // Frame the zones without concealing their central navigation lanes.
    for(let x=50;x<MAP_W;x+=110)if(Math.abs(x-720)>120){this.image('prop-'+(this.map==='beach'?'palm':'oak-round'),x,65,125,130);if(this.map!=='beach')this.image('prop-oak-round',x,MAP_H+20,125,130);}
    for(let i=0;i<32;i++){
      const x=70+Math.floor(rnd()*430)*3,y=130+Math.floor(rnd()*205)*3;
      if(Math.abs(x-720)>110&&Math.abs(y-432)>90&&!(this.map==='beach'&&y>580))this.image('prop-'+(i%2?'bush-pink':'bush-white'),x,y,42,36);
    }
    if(this.map==='forest'){
      this.image('prop-rocks',710,112,120,62);this.image('prop-rocks',853,123,124,62);
      this.image('prop-tent',888,370,156,132);this.fire=this.image('icon-camper',895,400,54);
      for(const [x,y]of [[840,450],[950,440],[800,400]])this.image('prop-bench',x,y,72,48);
    }
    if(this.map==='farm'){
      this.image('prop-greenhouse',1035,280,240,204);this.house(160,180,195,150,'ฟาร์มเพื่อนรัก');
      for(let x=950;x<1180;x+=72){this.image('prop-fence',x+32,560,78,50);this.image('prop-fence',x+32,678,78,50);}
      this.farmCat=this.scene.add.image(1020,610,'nature-cat-sit').setDisplaySize(48,48).setDepth(610);
      this.scene.add.image(1120,625,'nature-rabbit-0-0').setDisplaySize(44,44).setDepth(625);
    }
    if(this.map==='beach'){
      this.image('prop-bench',1230,350,78,48);this.image('prop-palm',1170,525,128,150);
      for(const y of [602,700,780]){this.image('prop-lamp',1038,y,28,56);this.image('prop-lamp',1116,y,28,56);}
    }
    if(this.map==='market'){
      this.house(290,270,270,175,'คาเฟ่');this.house(890,360,230,90,'ร้านแลกชุด');
      for(const [x,y]of [[640,340],[700,630],[1120,650]])this.image('prop-stall',x,y,140,128);
      for(let x=180;x<1250;x+=150)this.image('prop-lamp',x,440,42,90);
      for(let x=240;x<1250;x+=100)this.image('prop-lamp',x,240,28,60);
    }
    for(const node of WORLD_NODES.filter(n=>n.map===this.map)){
      if(node.kind==='water'){
        this.scene.add.ellipse(node.x,node.y,68,42,0x73d4ef).setStrokeStyle(7,0xb2a17d).setDepth(node.y-1);
      }
      // Activity titles live in the nearby menu/prompt, not floating over every prop.
      if(['bug','rare'].includes(node.kind)){
        const kind=node.kind==='rare'?'rabbit-2':node.id==='bug-gold'?'ladybug-1':'butterfly-0';
        const sprite=this.scene.add.image(node.x,node.y-10,'nature-'+kind+'-0').setDisplaySize(36,36).setDepth(node.y);
        this.movingSprites.push({sprite,x:node.x,y:node.y-10,kind,id:node.id});
      }
      const icon=({mushroom:'mushroom',shell:node.id==='shell-a'?'shell':'pearl',cleanup:'cleanup',treasure:'treasure'} as Record<string,string>)[node.kind];
      if(icon)this.image('icon-'+icon,node.x,node.y+8,42);
    }
    if(this.map==='farm')for(const plot of FARM_PLOTS){this.scene.add.text(plot.x,plot.y+16,String(plot.slot+1),{fontFamily:FONT,fontSize:'12px',color:'#fff1c9',backgroundColor:'#654e38',padding:{x:4,y:1}}).setOrigin(.5).setDepth(plot.y+18);this.crops.push(this.image('icon-carrot',plot.x,plot.y,42).setVisible(false));}
    this.boat=this.image('icon-voyager',1080,690,100).setVisible(false);
    this.water=this.scene.add.graphics().setDepth(-990);
    this.drawExits();
  }
  private house(x:number,y:number,w:number,h:number,name:string){
    this.image(name==='คาเฟ่'?'prop-cafe':'prop-boardgame',x+w/2,y+h,w+30,w+30);
    this.scene.add.text(x+w/2,y+h*.48,name,{fontFamily:FONT,fontSize:'14px',color:'#ffe6a5',backgroundColor:'#61412d',padding:{x:6,y:3}}).setOrigin(.5).setDepth(y+h+1);
  }
  static exits(scene:Phaser.Scene,map:MapId){new WorldRenderer(scene,map).drawExits();}
  private drawExits(){
    const positions:[Direction,number,number][]=[['north',720,110],['south',720,820],['west',60,420],['east',1380,420]];
    for(const [direction,x,y]of positions){
      const next=destination(this.map,direction);if(!next)continue;
      const arrow=({north:'↑',south:'↓',west:'←',east:'→'} as const)[direction];
      this.image('ui-title',x,y-20,112,38,false);
      this.scene.add.text(x,y-20,arrow+' '+MAP_NAMES[next],{fontFamily:FONT,fontSize:'12px',color:'#fff1d5'}).setOrigin(.5).setDepth(y+1);
    }
  }
  update(view:WorldView|undefined,weather='sunny',owner?:string){
    const t=this.motion.matches?0:this.scene.time.now;
    if(view!==this.clockView){this.clockView=view;this.receivedAt=Date.now();}
    const now=(view?.serverTime??this.receivedAt)+Date.now()-this.receivedAt;
    this.farmCat?.setTexture('nature-cat-'+(['sit','groom','stretch','sleep'][Math.floor(t/6500)%4]));
    for(const moving of this.movingSprites){moving.sprite.setVisible((view?.progress.cooldowns[moving.id]??0)<=Date.now()&&(moving.id!=='forest-rare'||weather==='snow')&&(moving.id!=='bug-firefly'||Math.floor(Date.now()/300000)%4>=2));moving.sprite.setPosition(moving.x+Math.round(Math.sin(t/1300+moving.x)*9),moving.y+Math.round(Math.cos(t/850+moving.x)*5));moving.sprite.setTexture('nature-'+moving.kind+'-'+Math.floor(t/220)%2);}
    this.fire?.setScale(.84+Math.sin(t/180)*.015);
    this.water?.clear();
    if(this.map==='forest')for(let i=0;i<6;i++)this.water?.fillStyle(0xe4ffff,.65).fillRect(752+i*7,90+(Math.floor(t/60+i*6)%110),3,12);
    if(this.map==='beach')for(let i=0;i<8;i++)this.water?.fillStyle(0xe4ffff,.5).fillRect(i*180+(Math.floor(t/110)%20)*3,626+Math.floor(Math.sin(t/800+i)*3),48,3);
    if(this.map==='farm')this.crops.forEach((sprite,i)=>{
      const crop=(owner?view?.farms.find(f=>f.id===owner)?.plots:view?.progress.plots)?.[i];sprite.setVisible(!!crop);if(!crop)return;
      const stage=growthStage(crop,now),asset='crop-'+crop.seed+'-'+stage;
      const key='ref-'+asset;if(!this.scene.textures.exists(key))this.scene.textures.addImage(key,artImage(asset));
      sprite.setTexture(key).setDisplaySize(stage===0?25:stage===1?33:stage===2?40:46,stage===0?25:stage===1?33:stage===2?40:46).setAlpha(1);
    });
    if(this.map==='farm'&&view){
      const next=new Map<string,boolean>();for(const farm of view.farms)farm.plots.forEach((crop,i)=>{if(!crop)return;const id=farm.id+':'+i+':'+crop.plantedAt;next.set(id,crop.watered);if(this.hasFarmView&&crop.watered&&this.watered.get(id)===false&&(owner??view.farms[0]?.id)===farm.id)this.watering(FARM_PLOTS[i].x,FARM_PLOTS[i].y);});this.watered=next;this.hasFarmView=true;
    }
    this.boat?.setVisible(this.map==='beach'&&!!view?.boat&&Date.now()>=view.boat.departAt);
    if(this.boat&&view?.boat){const p=boatPosition(view.boat.departAt,Date.now());this.boat.setPosition(p.x,p.y).setDepth(p.y-1);}
  }
  private watering(x:number,y:number){
    const can=this.image('tool-watering-can',x+24,y-18,38).setDepth(y+100);
    if(this.motion.matches){this.scene.time.delayedCall(700,()=>can.destroy());return;}
    can.setAngle(-8);this.scene.tweens.add({targets:can,angle:8,y:y-22,yoyo:true,repeat:1,duration:220,onComplete:()=>can.destroy()});
    for(let i=0;i<8;i++){const drop=this.image('tool-water',x+6,y-27,6,9).setDepth(y+101);this.scene.tweens.add({targets:drop,x:x-14+(i%4)*8,y:y+4,alpha:0,delay:i*65,duration:420,onComplete:()=>drop.destroy()});}
  }
}
