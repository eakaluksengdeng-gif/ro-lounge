import {artCanvas} from '../reference/Assets';
export const CAT_POSES=['walk-0','walk-1','sit','groom','stretch','sleep'] as const;
export type CatPose=typeof CAT_POSES[number];
export const CAT_COATS=[
 ['#793d22','#bc6329','#e58c38','#ffb95c'],
 ['#593a27','#95602f','#c38a4c','#e6bc7b'],
 ['#414956','#707d8e','#9caaba','#cbd4df'],
] as const;
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
/** Every pose comes from one model sheet. Only fur changes; cream, eyes,
 * pink ears, blue collar and gold bell retain the same identity colors. */
export function catCanvas(pose:CatPose,variant=0){
 const canvas=artCanvas('cat-v2-'+pose,48),ctx=canvas.getContext('2d')!,pixels=ctx.getImageData(0,0,48,48),d=pixels.data,palette=CAT_COATS[((variant%3)+3)%3].map(rgb);
 for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(!d[i+3])continue;
  const fur=r>g*1.18&&g>b*1.2&&r+g+b>170&&!(g/r>.68&&b/g<.45);
  if(fur){const level=r<145?0:r<200?1:r<240?2:3;[d[i],d[i+1],d[i+2]]=palette[level];}
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
