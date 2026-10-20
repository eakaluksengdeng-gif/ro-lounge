/** Alpha-trim and pixel-export original generated scenery, without recoloring it. */
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../art-source/scenery-v1/',import.meta.url));
const output=fileURLToPath(new URL('../public/art/scenery-v1/',import.meta.url));await mkdir(output,{recursive:true});
for(const [id,width,height]of [['well',128,112],['waterfall',128,256],['farmhouse',192,192]]){
 const {data,info}=await sharp(source+id+'-source.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(data[i+3]<180)data[i+3]=0;else{data[i+3]=255;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 if(right<left)throw new Error('Empty scenery: '+id);
 await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(width,height,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(output+'scenery-'+id+'.png');
}
await writeFile(output+'manifest.json',JSON.stringify({version:'scenery-v1',props:['scenery-well','scenery-waterfall','scenery-farmhouse']},null,2)+'\n');
console.log('Exported three alpha-clean pixel scenery assets');
