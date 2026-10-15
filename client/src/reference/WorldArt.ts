import { artImage } from './Assets';
import { MAP_W,MAP_H,POND,PLAZA,PATH_ROWS,PATH_COLS,TILE_PX } from '../world';
import type { MapId } from '../../../shared/regions';
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
    rounded('pond',590,90,36,222,18);pond(780,210,180,75);
    // Rounded mossy boulders replace the former rectangular cliff slab.
    for(const [x,y,w]of [[650,100,98],[711,78,108],[804,83,114],[882,110,90]])c.drawImage(artImage('activity-rocks'),x,y,w,66);
    rounded('pond-alt',748,84,54,140,18);tile('wood',570,286,78,30);
    c.strokeStyle='#65442c';c.lineWidth=4;c.strokeRect(570,286,78,30);
  }
  if(map==='farm')for(let row=0;row<2;row++)for(let col=0;col<2;col++)rounded('soil',370+col*130,340+row*80,112,64,16);
  if(map==='beach'){
    tile('ocean',0,622,MAP_W,MAP_H-622);c.strokeStyle='#d9ffff';c.lineWidth=6;c.beginPath();c.moveTo(0,624);for(let x=0;x<=MAP_W;x+=24)c.lineTo(x,624+Math.sin(x/100)*4);c.stroke();
    tile('wood',1044,570,72,222);
  }
  if(map==='market'){tile('market',180,480,1040,96);tile('wood',850,228,240,93);}
  return canvas;
}
