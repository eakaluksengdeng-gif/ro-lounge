import Phaser from "phaser";
import { MAP_COLORS, MAP_NAMES, WORLD_NODES, destination, type Direction, type MapId, type WorldView, boatPosition } from "../../../shared/regions";
import { MAP_H, MAP_W, PX, TILE_PX } from "../world";
import { mulberry32 } from "../art";
import { buildNatureTextures } from "../nature/art";
const FONT='"Noto Sans Thai", Arial, sans-serif';
type G=Phaser.GameObjects.Graphics;
function ellipse(g:G,color:number,x:number,y:number,rx:number,ry:number) {
  g.fillStyle(color);
  for(let py=-ry;py<=ry;py+=6){const span=Math.floor(rx*Math.sqrt(Math.max(0,1-(py/ry)**2))/3)*3;g.fillRect(x-span,y+py,span*2,6);}
}
export class WorldRenderer {
  private motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  private cropGraphics?:G;
  private boatGraphics?:G;
  private waterEffects?:G;
  private movingSprites:{sprite:Phaser.GameObjects.Image;x:number;y:number;kind:string;id:string}[]=[];
  constructor(private scene:Phaser.Scene,private map:MapId) {}
  draw() {
    buildNatureTextures(this.scene);
    const s=this.scene,g=s.add.graphics().setDepth(-1000),rnd=mulberry32(37+this.map.length);
    g.fillStyle(MAP_COLORS[this.map]).fillRect(0,0,MAP_W,MAP_H);
    for(let y=0;y<18;y++)for(let x=0;x<30;x++){
      const isPath=(x===14||x===15)||(y===8||y===9);
      if(this.map!=="beach"||y<13)g.fillStyle(isPath?0xcbbf91:(rnd()<.5?MAP_COLORS[this.map]:MAP_COLORS[this.map]+0x050405)).fillRect(x*48,y*48,48,48);
      if(!isPath) for(let i=0;i<4;i++)g.fillStyle(this.map==="beach"?0xd5bb86:0x83a46b,.5).fillRect(x*48+Math.floor(rnd()*15)*3,y*48+Math.floor(rnd()*15)*3,3,3);
    }
    // Open central lanes stay navigable. Decorations are outside those lanes.
    const trees=this.map==="beach"?[[180,220],[1230,240]]:this.map==="market"?[[120,220],[1230,600],[200,700]]:[[160,200],[320,140],[1160,160],[1300,330],[170,570],[310,710],[1230,720],[1160,580],[400,280]];
    for(const [x,y] of trees)s.add.image(x,y,"tree").setOrigin(.5,34/37).setScale(PX).setTint(this.map==="forest"?0x94b68f:0xd6daba).setDepth(y);
    for(let i=0;i<42;i++){const x=90+Math.floor(rnd()*400)*3,y=130+Math.floor(rnd()*215)*3;
      if(Math.abs(x-720)>100&&Math.abs(y-432)>80&&!(this.map==="beach"&&y>580)){
        g.fillStyle(0x729768).fillRect(x,y,3,12).fillRect(x+3,y+6,6,3);
        g.fillStyle(i%2?0xeab5b2:0xece4b9).fillRect(x-3,y-3,9,3).fillRect(x,y-6,3,9);
        g.fillStyle(0xd4bb76).fillRect(x,y-3,3,3);
      }
    }
    if(this.map==="forest")this.forest(g);
    if(this.map==="farm")this.farm(g);
    if(this.map==="beach")this.beach(g);
    if(this.map==="market")this.market(g);
    for(const node of WORLD_NODES.filter(n=>n.map===this.map)) {
      const sign=s.add.text(node.x,node.y+34,node.name,{fontFamily:FONT,fontSize:"12px",color:"#fff0ca",backgroundColor:"#21372fd9",padding:{x:5,y:3}}).setOrigin(.5).setDepth(node.y+40);
      if(["bug","rare"].includes(node.kind)){
        const kind=node.kind==="rare"?"rabbit-2":node.id==="bug-gold"?"ladybug-1":"butterfly-0";
        const sprite=s.add.image(node.x,node.y-10,"nature-"+kind+"-0").setScale(3).setDepth(node.y);
        this.movingSprites.push({sprite,x:node.x,y:node.y-10,kind,id:node.id});
      }
      if(node.kind==="mushroom"){const a=s.add.graphics().setDepth(node.y);a.fillStyle(0xf6e9ca).fillRect(node.x-6,node.y-12,12,18);a.fillStyle(0xb66a70).fillRect(node.x-18,node.y-27,36,15).fillRect(node.x-12,node.y-33,24,6);a.fillStyle(0xffe9cf).fillRect(node.x-6,node.y-27,6,6);}
      if(node.kind==="shell"){const a=s.add.graphics().setDepth(node.y);ellipse(a,node.id==="shell-a"?0xf4bbae:0xf6e9ca,node.x,node.y,15,12);a.lineStyle(2,0xc39392).lineBetween(node.x,node.y+12,node.x-9,node.y-6).lineBetween(node.x,node.y+12,node.x+9,node.y-6);}
      if(node.kind==="cleanup"){const a=s.add.graphics().setDepth(node.y);a.fillStyle(0x90b5c6).fillRect(node.x-9,node.y-15,15,21);a.fillStyle(0xf6e9ca).fillRect(node.x-6,node.y-9,9,6);}
      if(node.kind==="treasure"){const a=s.add.graphics().setDepth(node.y);a.fillStyle(0x82614d).fillRect(node.x-21,node.y-15,42,27);a.fillStyle(0xe4c46f).fillRect(node.x-21,node.y-15,42,6).fillRect(node.x-3,node.y-12,6,12);}
      sign.setData("worldNode",node.id);
    }
    this.drawExits();
    this.cropGraphics=s.add.graphics().setDepth(470);
    this.boatGraphics=s.add.graphics().setDepth(650);
    this.waterEffects=s.add.graphics().setDepth(-990);
  }
  static exits(scene:Phaser.Scene,map:MapId) {new WorldRenderer(scene,map).drawExits();}
  private drawExits() {
    const positions:[Direction,number,number][]=[["north",720,110],["south",720,820],["west",60,420],["east",1380,420]];
    for(const [direction,x,y] of positions) {
      const next=destination(this.map,direction);if(!next)continue;
      const arrow=({north:"↑",south:"↓",west:"←",east:"→"} as const)[direction];
      const g=this.scene.add.graphics().setDepth(y);g.fillStyle(0x76563b).fillRect(x-4,y-16,8,38);g.fillStyle(0xc09563).fillRect(x-48,y-33,96,27);g.lineStyle(3,0x4e3d31).strokeRect(x-48,y-33,96,27);
      this.scene.add.text(x,y-20,arrow+" "+MAP_NAMES[next],{fontFamily:FONT,fontSize:"12px",color:"#fff1d5"}).setOrigin(.5).setDepth(y+1);
    }
  }
  private forest(g:G) {
    // Draw the same stream footprint as the shared collision, with a walkable wooden bridge.
    g.fillStyle(0x40575e).fillRect(584,90,48,222);
    g.fillStyle(0x72b5b2).fillRect(590,90,36,222);
    g.fillStyle(0x9bd2ce).fillRect(596,96,6,190).fillRect(617,102,3,184);
    ellipse(g,0x40575e,780,210,192,87);ellipse(g,0x72b5b2,780,210,180,75);
    g.fillStyle(0x795a41).fillRect(570,286,78,30);
    for(let x=576;x<648;x+=12)g.fillStyle(0xc39560).fillRect(x,289,9,24);
    g.fillStyle(0x604631).fillRect(570,286,78,3).fillRect(570,313,78,3);
    g.fillStyle(0x4d6661).fillRect(680,78,220,45);g.fillStyle(0x87cbd0).fillRect(748,84,54,140);
    for(let i=0;i<7;i++)g.fillStyle(i%2?0xd3eee0:0xa1dad4).fillRect(748+i*6,90,3,126);
    g.fillStyle(0xc3dcd0).fillRect(714,225,96,6);
    const camp=this.scene.add.graphics().setDepth(390);
    camp.fillStyle(0x96735b).fillRect(828,296,120,66);camp.fillStyle(0xd4b885).fillTriangle(828,362,888,266,948,362);
    camp.fillStyle(0x4c473c).fillTriangle(870,362,888,308,906,362);
    for(let i=0;i<6;i++)camp.fillStyle(0x9b9781).fillRect(864+i*12,397+(i%2)*6,12,9);
    camp.fillStyle(0xeda568).fillRect(885,376,18,24);camp.fillStyle(0xffdf83).fillRect(891,367,6,30);
    for(const [x,y] of [[840,450],[950,440],[800,400]])this.scene.add.image(x,y,"bench").setScale(PX).setDepth(y);
    this.scene.add.circle(895,390,75,0xffd38a,.06).setDepth(395);
  }
  private farm(g:G) {
    for(let row=0;row<2;row++)for(let col=0;col<2;col++) {
      g.fillStyle(0x856044).fillRect(370+col*130,340+row*80,112,64);
      for(let line=0;line<5;line++)g.fillStyle(0xa87b51).fillRect(376+col*130,348+row*80+line*9,100,3);
    }
    const h=this.scene.add.graphics().setDepth(280);
    h.fillStyle(0x557d74).fillRect(930,160,210,115);h.fillStyle(0xb5d6cb).fillRect(939,169,192,99);
    for(let x=950;x<1130;x+=42)h.fillStyle(0x709e8d).fillRect(x,169,6,99);
    for(let y=185;y<270;y+=30)h.fillStyle(0x709e8d).fillRect(939,y,192,6);
    h.fillStyle(0x65816f).fillTriangle(918,163,1035,106,1152,163);
    h.fillStyle(0x324c47).fillRect(1014,224,42,51);
    g.fillStyle(0x87603d).fillRect(950,550,220,9).fillRect(950,670,220,9);
    for(let x=950;x<1180;x+=30)g.fillStyle(0xc19e64).fillRect(x,543,9,39).fillRect(x,653,9,39);
    for(const [x,y,kind] of [[1020,610,"cat"],[1120,625,"rabbit"]] as const)this.scene.add.image(x,y,"nature-"+kind+"-0-0").setScale(3).setDepth(y);
    this.house(160,180,195,150,"ฟาร์มเพื่อนรัก");
  }
  private beach(g:G) {
    g.fillStyle(0x60acb4).fillRect(0,622,MAP_W,MAP_H-622);
    for(let row=0;row<6;row++)for(let x=0;x<1440;x+=81)g.fillStyle(row%2?0x85ced0:0x59a6b0).fillRect(x+(row%3)*12,640+row*39,39,3);
    g.fillStyle(0xe2efdc).fillRect(0,619,MAP_W,6);
    g.fillStyle(0x795a41).fillRect(1044,570,72,222);
    for(let y=570;y<790;y+=18)g.fillStyle(0xc39560).fillRect(1050,y,60,12);
    for(const x of [1038,1116])for(const y of [602,700,780])g.fillStyle(0x604631).fillRect(x,y-15,6,30);
    g.fillStyle(0xacc291).fillRect(1160,425,130,80);g.fillStyle(0xf7e3b1).fillRect(1160,425,130,6).fillRect(1160,455,130,6);
    this.scene.add.image(1230,350,"bench").setScale(PX).setDepth(350);
    this.scene.add.text(1200,395,"มุมพระอาทิตย์ตก",{fontFamily:FONT,fontSize:"13px",color:"#755a44"}).setOrigin(.5);
  }
  private market(g:G) {
    g.fillStyle(0x7c7c6a).fillRect(180,480,1040,96);
    for(let x=200;x<1220;x+=48)g.fillStyle(0x8e8b74).fillRect(x,487,42,36).fillRect(x+12,535,42,36);
    this.house(290,270,270,175,"คาเฟ่");
    this.house(890,360,230,90,"ร้านแลกชุด");
    const stage=this.scene.add.graphics().setDepth(310);stage.fillStyle(0x9e754e).fillRect(850,228,240,93);
    for(let y=240;y<315;y+=18)stage.fillStyle(0xc1935e).fillRect(856,y,228,9);
    stage.fillStyle(0x3b4947).fillRect(840,247,24,60).fillRect(1090,247,24,60);
    for(const [x,y,color] of [[640,340,0xbb7b82],[700,630,0x96b898],[1120,650,0xc2a078]]) {
      const stall=this.scene.add.graphics().setDepth(y);stall.fillStyle(0x936b4c).fillRect(x-60,y-40,120,40);
      for(let i=0;i<6;i++)stall.fillStyle(i%2?0xf5e5bc:color).fillRect(x-66+i*22,y-94,22,27);
      stall.fillStyle(0x74523c).fillRect(x-60,y-70,6,72).fillRect(x+54,y-70,6,72);
    }
    for(const [x,y]of [[640,510],[740,520],[620,650]]){ellipse(g,0xc6ac76,x,y,30,18);this.scene.add.image(x,y+24,"bench").setScale(2).setDepth(y+24);}
    for(let x=180;x<1250;x+=150){const lamp=this.scene.add.image(x,440,"lamp").setScale(PX).setDepth(440);this.scene.add.circle(x,380,36,0xffd47a,.12).setDepth(441);lamp.setTint(0xffdeb1);}
    for(let x=240;x<1250;x+=100){g.fillStyle(0x7b674a).fillRect(x,190,9,75);g.fillStyle(0xf4cf82).fillRect(x-9,210,27,30);}
  }
  private house(x:number,y:number,w:number,h:number,name:string) {
    const g=this.scene.add.graphics().setDepth(y+h);
    g.fillStyle(0x604937).fillRect(x,y+30,w,h-30);g.fillStyle(0xb27f57).fillRect(x+9,y+39,w-18,h-48);
    for(let py=y+50;py<y+h;py+=15)g.fillStyle(0x996b4c).fillRect(x+9,py,w-18,3);
    for(let i=0;i<4;i++)g.fillStyle(i%2?0x85546a:0x9d6271).fillRect(x-12+i*9,y+i*9,w+24-i*18,12);
    g.fillStyle(0x293b38).fillRect(x+w/2-21,y+h-51,42,51);
    for(const wx of [x+27,x+w-57])g.fillStyle(0xf0d391).fillRect(wx,y+h-87,30,30);
    this.scene.add.text(x+w/2,y+55,name,{fontFamily:FONT,fontSize:"14px",color:"#ffe6a5",backgroundColor:"#564034",padding:{x:6,y:3}}).setOrigin(.5).setDepth(y+h+1);
  }
  update(view:WorldView|undefined,weather="sunny") {
    const t=this.motion.matches?0:this.scene.time.now;
    for(const moving of this.movingSprites){moving.sprite.setVisible((moving.id!=="forest-rare"||weather==="snow")&&(moving.id!=="bug-firefly"||Math.floor(Date.now()/300000)%4>=2));moving.sprite.setPosition(moving.x+Math.round(Math.sin(t/1300+moving.x)*9),moving.y+Math.round(Math.cos(t/850+moving.x)*5));moving.sprite.setTexture("nature-"+moving.kind+"-"+(Math.floor(t/220)%2));}
    this.waterEffects?.clear();
    if(this.map==="forest")for(let i=0;i<6;i++)this.waterEffects?.fillStyle(0xe4f4e9,.6).fillRect(752+i*6,90+(Math.floor(t/60+i*6)%110),3,12);
    if(this.map==="beach")for(let i=0;i<8;i++)this.waterEffects?.fillStyle(0xe4f4e9,.5).fillRect(i*180+(Math.floor(t/110)%20)*3,626+Math.floor(Math.sin(t/800+i)*3),48,3);
    const g=this.cropGraphics;if(!g)return;g.clear();
    if(this.map==="farm"&&view) view.progress.plots.forEach((crop,i)=> {
      if(!crop)return;const x=i<4?410+(i%2)*130:984+(i-4)*78,y=i<4?367+Math.floor(i/2)*80:300;
      const age=Math.max(0,(Date.now()-crop.plantedAt)/Math.max(1,crop.readyAt-crop.plantedAt));
      const stage=Math.min(crop.watered?3:2,Math.floor(age*4));
      if(stage===0)g.fillStyle(0xcab78a).fillRect(x-3,y+6,6,3);
      else {
        const height=stage===1?9:18,spread=stage===1?9:15;
        g.fillStyle(stage===3?0x81ba61:0x70965a).fillRect(x-3,y-height+6,6,height).fillRect(x-spread,y-height+9,spread-3,6).fillRect(x+3,y-height+9,spread-3,6);
        if(stage===3)g.fillStyle(crop.seed==="carrot"?0xe4a15d:crop.seed==="tomato"?0xc97070:0xe0c570).fillRect(x-9,y,18,12);
      }
      if(crop.watered)g.fillStyle(0x78c5d0).fillRect(x+18,y+12,3,3);
    });
    const b=this.boatGraphics;b?.clear();
    if(this.map==="beach"&&view?.boat&&Date.now()>=view.boat.departAt){
      const p=boatPosition(view.boat.departAt,Date.now());b!.setDepth(p.y-1).fillStyle(0x5e493b).fillRect(p.x-42,p.y-3,84,24);
      b!.fillStyle(0xbc9564).fillRect(p.x-36,p.y-9,72,27);b!.fillStyle(0x795a44).fillRect(p.x-3,p.y-78,6,84);
      b!.fillStyle(0xf6e9ca).fillTriangle(p.x+3,p.y-75,p.x+42,p.y-15,p.x+3,p.y-15);
    }
  }
}
