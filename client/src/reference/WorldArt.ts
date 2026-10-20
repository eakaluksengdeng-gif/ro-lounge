import { artImage } from './Assets';
import { MAP_W,MAP_H,POND,PLAZA,PATH_ROWS,PATH_COLS,TILE_PX } from '../world';
import {FARM_PLOTS,type MapId} from '../../../shared/regions';
/** Raster composition uses unchanged gameplay coordinates, never baked fake interactions. */
export function groundCanvas(map:MapId){
  const canvas=document.createElement('canvas');canvas.width=MAP_W;canvas.height=MAP_H;
  const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
  const tile=(key:string,x:number,y:number,w:number,h:number)=>{const image=artImage(['pond','pond-alt','ocean'].includes(key)?'water-ripples':'tile-'+key);const p=c.createPattern(image,'repeat')!;c.fillStyle=p;c.fillRect(x,y,w,h);};
  const rounded=(key:string,x:number,y:number,w:number,h:number,r:number)=>{c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.clip();tile(key,x,y,w,h);c.restore();};
  tile(map==='forest'?'forest':map==='beach'?'sand':'grass',0,0,MAP_W,MAP_H);
  for(let y=0;y<18;y++)for(let x=0;x<30;x++){
    if(PATH_ROWS.includes(y)||PATH_COLS.includes(x))tile(map==='market'?'market':map==='forest'?'dirt':'stone',x*48,y*48,48,48);
  }
  if(map==='town'){
    rounded('stone',PLAZA.x0*48,PLAZA.y0*48,(PLAZA.x1-PLAZA.x0+1)*48,(PLAZA.y1-PLAZA.y0+1)*48,74);
    // Low flower islands soften the plaza corners without covering its walking lanes.
    for(const [x,y] of [[558,275],[884,275],[558,594],[884,594]]){
      c.save();c.beginPath();c.ellipse(x,y,41,25,0,0,Math.PI*2);c.clip();tile('grass',x-45,y-28,90,56);c.restore();
      c.drawImage(artImage('prop-bush-pink'),x-23,y-23,46,36);c.drawImage(artImage('activity-rocks'),x+13,y-9,27,22);
    }
    // Curved river-bank accents use the same moss/stone palette as the fountain.
    for(const [x,y]of [[466,596],[462,725],[97,550],[100,763]])c.drawImage(artImage('activity-reeds'),x-18,y-22,36,32);
  }
  const pond=(x:number,y:number,rx:number,ry:number)=>{
    c.save();c.beginPath();c.ellipse(x,y,rx+12,ry+12,0,0,Math.PI*2);c.clip();tile('sand',x-rx-12,y-ry-12,rx*2+24,ry*2+24);c.restore();
    c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.clip();tile('pond',x-rx,y-ry,rx*2,ry*2);c.restore();
    // Natural moss banks/rocks stay inside the existing water collision, preserving every fishing angle.
    for(const angle of [-2.65,-2.05,-.8,.9,1.65,2.45]){const px=x+Math.cos(angle)*(rx-15),py=y+Math.sin(angle)*(ry-10);c.drawImage(artImage('activity-rocks'),px-26,py-25,52,42);}
    for(const angle of [-2.4,-1.3,.65,2]){const px=x+Math.cos(angle)*(rx+9),py=y+Math.sin(angle)*(ry+9);c.drawImage(artImage('activity-reeds'),px-17,py-24,34,34);}
    c.strokeStyle='#cffff8';c.lineWidth=3;c.beginPath();c.ellipse(x,y,rx-2,ry-2,0,0,Math.PI*2);c.stroke();
  };
  if(map==='town')pond(POND.cx*TILE_PX,POND.cy*TILE_PX,POND.rx*TILE_PX,POND.ry*TILE_PX);
  if(map==='forest'){
    // Keep the river in its original collision strip, with textured uneven
    // banks rather than an isolated bright-blue capsule.
    pond(780,210,180,75);
    c.save();c.beginPath();c.moveTo(592,90);for(let y=90;y<=310;y+=10)c.lineTo(592+Math.sin(y/21)*2,y);for(let y=310;y>=90;y-=10)c.lineTo(623+Math.sin(y/24)*2,y);c.closePath();c.clip();tile('pond',589,88,39,224);c.restore();
    for(let y=94;y<286;y+=29){c.drawImage(artImage('activity-rocks'),576,y-9,29,24);c.drawImage(artImage('activity-rocks'),617,y+2,28,23);}
    c.drawImage(artImage('activity-rocks'),582,73,54,29);
    // Rounded mossy boulders replace the former rectangular cliff slab.
    for(const [x,y,w]of [[650,100,98],[711,78,108],[804,83,114],[882,110,90]])c.drawImage(artImage('activity-rocks'),x,y,w,66);
    c.drawImage(artImage('scenery-waterfall'),738,74,84,176);tile('wood',570,286,78,30);
    for(const [x,y]of [[582,120],[634,177],[582,237],[634,275]])c.drawImage(artImage('activity-reeds'),x-13,y-16,26,28);
    c.strokeStyle='#65442c';c.lineWidth=4;c.strokeRect(570,286,78,30);
  }
  if(map==='farm')for(const plot of FARM_PLOTS){const w=plot.slot<4?100:64,h=plot.slot<4?60:48;rounded('soil',plot.x-w/2,plot.y-h/2,w,h,14);c.strokeStyle='#79513d';c.lineWidth=2;c.beginPath();c.roundRect(plot.x-w/2,plot.y-h/2,w,h,14);c.stroke();}
  if(map==='beach'){
    tile('ocean',0,622,MAP_W,MAP_H-622);
    const shore=(x:number)=>626+Math.round(Math.sin(x/78)*2+Math.sin(x/41)*2);
    c.save();c.beginPath();c.moveTo(0,618);c.lineTo(MAP_W,618);for(let x=MAP_W;x>=0;x-=6)c.lineTo(x,shore(x));c.closePath();c.clip();tile('sand',0,618,MAP_W,16);c.restore();
    c.strokeStyle='#e0fff2';c.lineWidth=2;c.beginPath();c.moveTo(0,shore(0));for(let x=0;x<=MAP_W;x+=6)c.lineTo(x,shore(x));c.stroke();
    tile('wood',1044,570,72,222);
    for(const [x,y,w]of [[150,700,70],[380,780,96],[860,710,72],[1310,760,108]]){c.strokeStyle='#d7fff2';c.lineWidth=2;c.beginPath();c.ellipse(x,y+9,w*.47,w*.18,0,0,Math.PI*2);c.stroke();c.drawImage(artImage('activity-rocks'),x-w/2,y-w*.45,w,w*.7);}
  }
  if(map==='market'){tile('market',180,480,1040,96);tile('wood',850,228,240,93);}
  return canvas;
}
