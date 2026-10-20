import type Phaser from "phaser";
import { COSMETICS } from "../../../shared/regions";
import { artImage, artCanvas } from "../reference/Assets";
import {NEW_GEAR,SEASON_GEAR} from '../../../shared/equipment';
/** Generated gear shares the exact 48x64 canvas/foot anchor with live avatars. */
export function cosmeticCanvas(id:string,dir:'down'|'up'|'side'='down') {
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;
  const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  if(id==='none')return canvas;
  if(id==='cafe-apron')ctx.drawImage(artImage('icon-'+id),11,39,26,23);
  else {
    // Inventory icons contain padding. Trim alpha before fitting the crown to the head.
    const source=artImage('icon-'+id),scratch=document.createElement('canvas');scratch.width=source.width;scratch.height=source.height;
    const sc=scratch.getContext('2d')!;sc.drawImage(source,0,0);const pixels=sc.getImageData(0,0,source.width,source.height).data;
    let left=source.width,top=source.height,right=0,bottom=0;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    // The head retains its full skull width in the side view. A 38px hat
    // exposed the upper hair on both sides like a second hat underneath.
    if(right>=left){const side=dir==='side',chef=id==='chef-hat',w=chef?(side?42:44):(side?44:46),h=chef?24:23;ctx.drawImage(source,left,top,right-left+1,bottom-top+1,(48-w)/2,0,w,h);}
  }
  return canvas;
}
export function ensureCosmetics(scene:Phaser.Scene){for(const item of COSMETICS)if(!scene.textures.exists('gear-'+item.id))scene.textures.addCanvas('gear-'+item.id,cosmeticCanvas(item.id));}
export function itemCanvas(id:string){if(NEW_GEAR.some(g=>g.id===id)||SEASON_GEAR.some(g=>g.id===id))return artCanvas('equipment-'+id,64);if(['eggplant','strawberry','corn','pumpkin'].includes(id))return artCanvas('crop-'+id+'-3',64);if(['garden-salad','forest-soup','fish-soup','picnic-bread'].includes(id))return artCanvas('meal-'+id,64);return artCanvas(id==='bee'||id==='ladybug'?'animal-'+id+'-0':'icon-'+id,64);}
