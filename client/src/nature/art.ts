import Phaser from "phaser";
import type { AnimalKind } from "../../../shared/nature";
import { artCanvas } from "../reference/Assets";
import {catCanvas} from './CatArt';
function coat(canvas:HTMLCanvasElement,variant:number){
  if(!variant)return canvas;const ctx=canvas.getContext('2d')!,pixels=ctx.getImageData(0,0,48,48),d=pixels.data;
  for(let i=0;i<d.length;i+=4)if(d[i+3]>180&&d[i]>120&&d[i+1]>75){if(variant===1){d[i]=Math.min(255,d[i]+12);d[i+1]=Math.min(255,d[i+1]+15);}else{const light=(d[i]+d[i+1]+d[i+2])/3;d[i]=light*.9;d[i+1]=light*.96;d[i+2]=Math.min(255,light*1.05);}}ctx.putImageData(pixels,0,0);return canvas;
}
/** Real generated walking/flapping frames; variation is a subtle coat palette tint. */
export function buildNatureTextures(scene:Phaser.Scene){
  for(const pose of ['sit','groom','stretch','sleep'])for(let variant=0;variant<3;variant++){
    const key=`nature-cat-${variant}-${pose}`;if(!scene.textures.exists(key))scene.textures.addCanvas(key,catCanvas(pose as 'sit'|'groom'|'stretch'|'sleep',variant))?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if(variant===0&&!scene.textures.exists('nature-cat-'+pose))scene.textures.addCanvas('nature-cat-'+pose,catCanvas(pose as 'sit'|'groom'|'stretch'|'sleep'))?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  for(const kind of ['cat','rabbit','butterfly','bee','ladybug'] as AnimalKind[])for(let variant=0;variant<3;variant++)for(let frame=0;frame<2;frame++){
    const key=`nature-${kind}-${variant}-${frame}`;if(scene.textures.exists(key))continue;
    const canvas=kind==='cat'?catCanvas(frame===0?'walk-0':'walk-1',variant):coat(artCanvas(`animal-${kind}-${frame}`,48),variant);
    scene.textures.addCanvas(key,canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
