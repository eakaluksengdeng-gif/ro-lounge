import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'public/art/season-v1/';await mkdir(out,{recursive:true});const keys=[];
// Atlas neighbours occasionally leave tiny disconnected edge fragments. Retain only
// the subject component for plants/clothes/cats; emotes and watering drops stay intact.
async function subjectOnly(input){
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width,height}=info,seen=new Uint8Array(width*height);let largest=[];
 for(let at=0;at<width*height;at++){if(seen[at]||data[at*4+3]<=32)continue;const queue=[at];seen[at]=1;
  for(let i=0;i<queue.length;i++){const p=queue[i],x=p%width,y=Math.floor(p/width);for(const n of [x>0?p-1:-1,x+1<width?p+1:-1,y>0?p-width:-1,y+1<height?p+width:-1])if(n>=0&&!seen[n]&&data[n*4+3]>32){seen[n]=1;queue.push(n);}}
  if(queue.length>largest.length)largest=queue;
 }
 const keep=new Uint8Array(width*height);for(const p of largest)keep[p]=1;for(let i=0;i<keep.length;i++)if(!keep[i])data[i*4+3]=0;
 return sharp(data,{raw:{width,height,channels:4}}).png().toBuffer();
}
async function atlas(file,rows,edges){
 const source=root+'art-source/season-v1/'+file,{width,height}=await sharp(source).metadata();
 for(let row=0;row<rows.length;row++)for(let col=0;col<4;col++){
  const key=rows[row][col],left=Math.round(width*col/4),right=Math.round(width*(col+1)/4),top=Math.round(height*edges[row]),bottom=Math.round(height*edges[row+1]);
  let crop=await sharp(source).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
  if(/^(crop|cat|equipment)-/.test(key))crop=await subjectOnly(crop);
  await sharp(crop).trim().resize(96,96,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(out+key+'.png');keys.push(key);
 }
}
await atlas('crops-atlas.png',['eggplant','strawberry','corn','pumpkin'].map(id=>Array.from({length:4},(_,i)=>'crop-'+id+'-'+i)),[0,.25,.485,.755,1]);
await atlas('classic-crops-atlas.png',['carrot','tomato','wheat'].map(id=>Array.from({length:4},(_,i)=>'crop-'+id+'-'+i)),[0,1/3,2/3,1]);
await atlas('cozy-atlas.png',[
 ['cream-knit','moss-hoodie','amber-raincoat','berry-cardigan'].map(id=>'equipment-'+id),
 ['happy','sad','love','wave'].map(id=>'emote-'+id),
 ['emote-angry','emote-sleepy','tool-watering-can','tool-water'],
 ['sit','groom','stretch','sleep'].map(id=>'cat-'+id),
],[.05,.29,.51,.716,1]);
await writeFile(out+'manifest.json',JSON.stringify({season:keys},null,2)+'\n');
