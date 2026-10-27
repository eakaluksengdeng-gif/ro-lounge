import Phaser from "phaser";
import { artImage, artCanvas } from './reference/Assets';
import {cosmeticCanvas} from './world/Cosmetics';
// Generated raster layers; no procedural placeholder characters or terrain remain.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// amt > 0 ทำให้สว่างขึ้น, amt < 0 ทำให้เข้มขึ้น
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const m = (v: number) => Math.round(v + (t - v) * k);
  return `#${[m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export type Dir = "down" | "up" | "side";
export type CharacterPose = 'standing'|'seated'|'fishing'|'prepare'|'cook'|'serve';

export interface Look {
  id: string;
  shirt: string;
  hair: string;
  skin: string;
  pants: string;
  style: number; // 0 ผมสั้น, 1 ผมยาว, 2 มวยผม
  gender?: number; // 0 male novice / 1 female novice; style variants depend on gender.
}

export const CHAR_W = 46;
export const CHAR_H = 62;
export const CHAR_SCALE = 1.125; // Keep the original 54x72 world footprint at richer sprite resolution.
// จุดเท้าอยู่ล่างสุดของภาพ (รวมขอบ 1 พิกเซล)
export const CHAR_ORIGIN_Y = (CHAR_H + 1) / (CHAR_H + 2);
const headOffsets=new Map<string,number>();
function headOffset(key:string){
  if(headOffsets.has(key))return headOffsets.get(key)!;
  const probe=artCanvas(key,46,43),data=probe.getContext('2d')!.getImageData(0,0,46,43).data;let chin=0;
  for(let y=0;y<43;y++)for(let x=18;x<30;x++)if(data[(y*46+x)*4+3]>180)chin=Math.max(chin,y);
  const offset=Math.max(0,38-chin);headOffsets.set(key,offset);return offset;
}

/** DOM previews and game textures share exactly the same pixel renderer. */
export function renderCharacterCanvas(look: Look, dir: Dir = "down", frame = 0, pose:CharacterPose='standing',headwear?:string): HTMLCanvasElement {
  const gender=look.gender===1?1:0;
  const canvas=artCanvas(pose==='standing'?`character-${gender}-${dir}-${frame}`:`pose-${gender}-${pose}-${dir}`,48,64),context=canvas.getContext('2d')!;
  // Generated heads replace the complete head layer; body/feet remain the walking frame.
  context.clearRect(0,0,48,40);
  const head=`head-${gender}-${look.style%3}-${dir}`;
  // Shorter generated heads (notably pigtails) need a chin anchor, not a
  // top-edge anchor. Bridge only transparent pixels behind the shirt/head.
  context.save();context.globalCompositeOperation='destination-over';context.fillStyle='#ffdcc0';context.fillRect(21,34,7,10);context.fillStyle='#32251f';context.fillRect(20,34,9,10);context.restore();
  if(gender===1&&dir==='down'){
    // The generated head already has a closed neck outline, while the body
    // has its own collar. Joining alpha behind them leaves two dark seams.
    // Open only the centre of that duplicated outline into a skin bridge;
    // retain the chin edges, side hair, white collar and tie below row 41.
    // Seat the face three pixels closer to the collar, and exclude only the
    // head asset's baked-in neck below the join. Side locks remain uncut.
    context.save();context.beginPath();context.rect(0,0,48,40);context.rect(0,40,20,24);context.rect(29,40,19,24);context.clip();
    context.drawImage(artImage(head),1,headOffset(head)+3,46,43);context.restore();
    context.fillStyle='#ffdcc0';context.fillRect(22,39,5,2);context.fillRect(23,41,4,1);
  }else context.drawImage(artImage(head),1,headOffset(head),46,43);
  const pixels=context.getImageData(0,0,48,64),d=pixels.data;
  const hair=hexToRgb(look.hair),shirt=hexToRgb(look.shirt),skin=hexToRgb(look.skin),pants=hexToRgb(look.pants);
  for(let y=0;y<64;y++)for(let x=0;x<48;x++){
    const i=(y*48+x)*4;if(d[i+3]<180)continue;const r=d[i],g=d[i+1],b=d[i+2];
    let target:number[]|undefined,base:number[]|undefined;
    if(y<43&&r>g*1.25&&g>b*1.12&&r<205){target=hair;base=[120,69,43];}
    else if(r>g*1.03&&g>b*1.08&&r>185&&g>125){target=skin;base=[255,220,192];}
    else if(y>=38&&y<(gender?49:53)&&b>r*1.08&&g>r*1.06){target=shirt;base=[120,217,236];}
    else if(y>=(gender?49:53)&&r<100&&b>r*1.4&&b>g*1.3){target=pants;base=[26,55,126];}
    if(target&&base){const light=(r+g+b)/(base[0]+base[1]+base[2]);for(let j=0;j<3;j++)d[i+j]=Math.max(0,Math.min(255,Math.round(target[j]*light)));}
  }
  context.putImageData(pixels,0,0);
  if(headwear&&headwear!=='none'){
    // Tuck only the upper crown into the hat silhouette. Preserve the face,
    // fringe, side locks and long hair below the cap line (never a bald head).
    const hat=cosmeticCanvas(headwear,dir).getContext('2d')!.getImageData(0,0,48,64).data;
    const image=context.getImageData(0,0,48,64);
    for(let y=0;y<17;y++)for(let x=0;x<48;x++)if(hat[(y*48+x)*4+3]<32)image.data[(y*48+x)*4+3]=0;
    context.putImageData(image,0,0);
  }
  return canvas;
}

export function characterTextureKey(look:Look,dir:Dir,frame=0,pose:CharacterPose='standing',headwear?:string){
  return `ch-${look.id}${headwear&&headwear!=='none'?'-hat-'+headwear:''}-${pose==='standing'?'':pose+'-'}${dir}-${frame}`;
}
export function ensureCharacter(scene: Phaser.Scene, look: Look,headwear?:string) {
  const dirs: Dir[] = ["down", "up", "side"];
  for (const d of dirs) {
    for (let f = 0; f < 3; f++) {
      const key=characterTextureKey(look,d,f,'standing',headwear);
      if(!scene.textures.exists(key))scene.textures.addCanvas(key,renderCharacterCanvas(look,d,f,'standing',headwear))?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for(const pose of ['seated','fishing'] as const){const key=characterTextureKey(look,d,0,pose,headwear);if(!scene.textures.exists(key))scene.textures.addCanvas(key,renderCharacterCanvas(look,d,0,pose,headwear))?.setFilter(Phaser.Textures.FilterMode.NEAREST);}
  }
}

export function buildWorldTextures(scene: Phaser.Scene) {
  const add=(key:string,asset:string,w:number,h:number)=>{if(!scene.textures.exists(key))scene.textures.addCanvas(key,artCanvas(asset,w,h))?.setFilter(Phaser.Textures.FilterMode.NEAREST);};
  for(let i=0;i<4;i++){add('grass'+i,'tile-grass',48,48);add('flower'+i,'tile-flowers',48,48);}
  for(let i=0;i<3;i++)add('path'+i,'tile-stone',48,48);
  for(let i=0;i<2;i++){add('stone'+i,i?'tile-stone-alt':'tile-stone',48,48);add('water'+i,i?'tile-pond-alt':'tile-pond',48,48);add('fountain'+i,'fountain-garden',174,146);}
  add('sand0','tile-sand',48,48);add('tree','prop-oak',144,156);add('bush','prop-bush-white',66,54);add('bench','prop-bench',78,54);add('lamp','prop-lamp',48,90);
  add('board','ui-title',180,54);if(!scene.textures.exists('shadow')){const canvas=document.createElement('canvas');canvas.width=42;canvas.height=15;const c=canvas.getContext('2d')!;c.fillStyle='#173c3440';c.beginPath();c.ellipse(21,7,20,6,0,0,Math.PI*2);c.fill();scene.textures.addCanvas('shadow',canvas);}
}
