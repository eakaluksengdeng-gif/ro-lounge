import sharp from 'sharp';import {mkdir,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'public/art/cats-v2/';await mkdir(out,{recursive:true});
const source=root+'art-source/cats-v2/cat-identity-atlas.png';
const cells=[['walk-0',40,80,495,420],['walk-1',550,80,540,420],['sit',1100,80,420,420],['groom',40,540,480,450],['stretch',540,530,520,450],['sleep',1050,620,470,370]];
const crops=[];
for(const [pose,left,top,width,height]of cells){
 const {data,info}=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true}),seen=new Uint8Array(width*height);let largest=[];
 for(let at=0;at<width*height;at++){if(seen[at]||data[at*4+3]<128)continue;const queue=[at];seen[at]=1;
  for(let i=0;i<queue.length;i++){const p=queue[i],x=p%width,y=Math.floor(p/width);for(const n of [x>0?p-1:-1,x+1<width?p+1:-1,y>0?p-width:-1,y+1<height?p+width:-1])if(n>=0&&!seen[n]&&data[n*4+3]>=128){seen[n]=1;queue.push(n);}}
  if(queue.length>largest.length)largest=queue;
 }
 const keep=new Uint8Array(width*height);for(const p of largest)keep[p]=1;for(let i=0;i<keep.length;i++)data[i*4+3]=keep[i]?255:0;
 const buffer=await sharp(data,{raw:{width,height,channels:info.channels}}).png().toBuffer(),trimmed=await sharp(buffer).trim().png().toBuffer(),meta=await sharp(trimmed).metadata();crops.push({pose,buffer:trimmed,width:meta.width,height:meta.height});
}
// ONE scale for the whole model sheet, never resize each pose to fill its square.
// A sleeping cat stays low; a sitting cat does not grow a larger head on transition.
const scale=Math.min(88/Math.max(...crops.map(c=>c.width)),84/Math.max(...crops.map(c=>c.height)));
for(const crop of crops){const width=Math.round(crop.width*scale),height=Math.round(crop.height*scale),buffer=await sharp(crop.buffer).resize(width,height,{kernel:'nearest'}).png().toBuffer();await sharp({create:{width:96,height:96,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:buffer,left:Math.floor((96-width)/2),top:84-height}]).png().toFile(out+'cat-v2-'+crop.pose+'.png');}
// Use only the generated dock-cat edit rectangle. The remaining scene, fishing
// seat anchors, water and dock geometry stay byte-for-byte the original pixels.
const edited=await sharp(root+'art-source/cats-v2/dock-cat-edit.png').resize(720,540,{kernel:'nearest'}).png().toBuffer();
const patch=await sharp(edited).extract({left:587,top:218,width:72,height:76}).png().toBuffer();
await sharp(root+'public/art/activity-v2/activity-cove.png').composite([{input:patch,left:587,top:218}]).png().toFile(out+'cat-v2-cove.png');
await writeFile(out+'manifest.json',JSON.stringify({cats:[...cells.map(([pose])=>'cat-v2-'+pose),'cat-v2-cove']},null,2)+'\n');
