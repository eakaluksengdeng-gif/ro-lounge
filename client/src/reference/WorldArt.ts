import { artImage } from './Assets';
import { MAP_W,MAP_H,POND,PLAZA,PATH_ROWS,PATH_COLS,TILE_PX } from '../world';
import type { MapId } from '../../../shared/regions';
/** Raster composition uses unchanged gameplay coordinates, never baked fake interactions. */
export function groundCanvas(map:MapId){
  const canvas=document.createElement('canvas');canvas.width=MAP_W;canvas.height=MAP_H;
  const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
  const tile=(key:string,x:number,y:number,w:number,h:number)=>{const image=artImage('tile-'+key);const p=c.createPattern(image,'repeat')!;c.fillStyle=p;c.fillRect(x,y,w,h);};
  tile(map==='forest'?'forest':map==='beach'?'sand':'grass',0,0,MAP_W,MAP_H);
  for(let y=0;y<18;y++)for(let x=0;x<30;x++){
    if(PATH_ROWS.includes(y)||PATH_COLS.includes(x))tile(map==='market'?'market':map==='forest'?'dirt':'stone',x*48,y*48,48,48);
    if(map==='town'&&x>=PLAZA.x0&&x<=PLAZA.x1&&y>=PLAZA.y0&&y<=PLAZA.y1)tile('stone',x*48,y*48,48,48);
  }
  const pond=(x:number,y:number,rx:number,ry:number)=>{
    c.save();c.beginPath();c.ellipse(x,y,rx+12,ry+12,0,0,Math.PI*2);c.clip();tile('sand',x-rx-12,y-ry-12,rx*2+24,ry*2+24);c.restore();
    c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.clip();tile('pond',x-rx,y-ry,rx*2,ry*2);c.restore();
  };
  if(map==='town')pond(POND.cx*TILE_PX,POND.cy*TILE_PX,POND.rx*TILE_PX,POND.ry*TILE_PX);
  if(map==='forest'){
    tile('pond',590,90,36,222);pond(780,210,180,75);tile('cliff',680,78,220,45);
    tile('pond-alt',748,84,54,140);tile('wood',570,286,78,30);
    c.strokeStyle='#65442c';c.lineWidth=4;c.strokeRect(570,286,78,30);
  }
  if(map==='farm')for(let row=0;row<2;row++)for(let col=0;col<2;col++)tile('soil',370+col*130,340+row*80,112,64);
  if(map==='beach'){
    tile('ocean',0,622,MAP_W,MAP_H-622);c.strokeStyle='#d9ffff';c.lineWidth=6;c.beginPath();c.moveTo(0,624);for(let x=0;x<=MAP_W;x+=24)c.lineTo(x,624+Math.sin(x/100)*4);c.stroke();
    tile('wood',1044,570,72,222);
  }
  if(map==='market'){tile('market',180,480,1040,96);tile('wood',850,228,240,93);}
  return canvas;
}
