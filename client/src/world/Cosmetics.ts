import type Phaser from "phaser";
import { COSMETICS } from "../../../shared/regions";
import { artImage, artCanvas } from "../reference/Assets";
/** Generated gear shares the exact 48x64 canvas/foot anchor with live avatars. */
export function cosmeticCanvas(id:string) {
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;
  const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  if(id==='none')return canvas;
  if(id==='cafe-apron')ctx.drawImage(artImage('icon-'+id),11,39,26,23);
  else ctx.drawImage(artImage('icon-'+id),0,-1,48,27);
  return canvas;
}
export function ensureCosmetics(scene:Phaser.Scene){for(const item of COSMETICS)if(!scene.textures.exists('gear-'+item.id))scene.textures.addCanvas('gear-'+item.id,cosmeticCanvas(item.id));}
export function itemCanvas(id:string){return artCanvas('icon-'+id,64);}
