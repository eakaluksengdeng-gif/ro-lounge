/** Reproducible crop/anchor/nearest-neighbor conditioning of generated activity artwork. */
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../art-source/activity-v2/',import.meta.url));
const output=fileURLToPath(new URL('../public/art/activity-v2/',import.meta.url));
await mkdir(output,{recursive:true});
const manifest={version:'activity-v2',poses:[],props:[],scenes:[]};
async function atlas(name){const {data,info}=await sharp(source+name+'-source.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,...info};}
function box(a,x0,y0,x1,y1){let left=x1,top=y1,right=x0,bottom=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(a.data[(y*a.width+x)*4+3]>180){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>right)throw new Error('Empty activity atlas cell');return {left,top,width:right-left+1,height:bottom-top+1};}
function region(a,b){return sharp(a.data,{raw:{width:a.width,height:a.height,channels:4}}).extract(b);}
function cuts(a,axis,count){const length=axis==='x'?a.width:a.height,other=axis==='x'?a.height:a.width;let first=-1,bands=[];
  for(let i=0;i<=length;i++){let n=0;if(i<length)for(let j=0;j<other;j++){const p=axis==='x'?(j*a.width+i)*4:(i*a.width+j)*4;if(a.data[p+3]>180)n++;}if(n>5&&first<0)first=i;if(n<=5&&first>=0){if(bands.length&&first-bands.at(-1)[1]<24)bands.at(-1)[1]=i;else bands.push([first,i]);first=-1;}}
  if(bands.length!==count)throw new Error('Inspect atlas segmentation: '+axis+' '+JSON.stringify(bands));
  return [0,...bands.slice(1).map((b,i)=>Math.floor((bands[i][1]+b[0])/2)),length];
}
for(const [name,rows]of [['activity-poses',4],['cafe-poses',2]]){
  const a=await atlas(name),xs=cuts(a,'x',3),ys=cuts(a,'y',rows);
  for(let row=0;row<rows;row++)for(let col=0;col<3;col++){
    const b=box(a,xs[col],ys[row],xs[col+1],ys[row+1]);
    const gender=name==='activity-poses'?Math.floor(row/2):row;
    const mode=name==='activity-poses'?row%2?'fishing':'seated':['prepare','cook','serve'][col];
    const dir=name==='activity-poses'?['down','side','up'][col]:'down';
    const key='pose-'+gender+'-'+mode+'-'+dir;
    const input=await region(a,b).resize({height:62,kernel:'nearest'}).png().toBuffer(),m=await sharp(input).metadata();
    if(m.width>48)throw new Error('Pose does not fit shared character frame: '+key);
    await sharp({create:{width:48,height:64,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input,left:Math.floor((48-m.width)/2),top:1}]).png().toFile(output+key+'.png');manifest.poses.push(key);
  }
}
const a=await atlas('activity-props');
// Hand-checked crop rectangles preserve complete props despite unequal illustration cell margins.
const names=['chair','dock','rocks','reeds','cat','crown','counter','shelf'];
const boxes=[[30,55,345,385],[400,55,530,385],[935,75,440,370],[1380,85,396,355],[30,550,365,240],[465,560,275,230],[800,460,595,360],[1410,450,366,390]];
for(let i=0;i<names.length;i++){const [x,y,w,h]=boxes[i];const b=box(a,x,y,Math.min(a.width,x+w),Math.min(a.height,y+h)),key='activity-'+names[i];await region(a,b).resize(i===6?512:128,i===6?256:128,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(output+key+'.png');manifest.props.push(key);}
await sharp(source+'fishing-cove-source.png').resize(720,540,{kernel:'nearest'}).png().toFile(output+'activity-cove.png');manifest.scenes.push('activity-cove');
await writeFile(output+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Exported activity-v2:',manifest.poses.length,'poses,',manifest.props.length,'props, one scene');
