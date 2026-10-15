import sharp from 'sharp';import {mkdir,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../art-source/equipment-v1/equipment-atlas.png',import.meta.url)),out=fileURLToPath(new URL('../public/art/equipment-v1/',import.meta.url));await mkdir(out,{recursive:true});
const sprites=[['woodland-boots',20,50,490,380],['butterfly-net',530,0,480,480],['garden-gloves',1040,80,480,370],['linen-apron',20,475,490,515],['wooden-rod',530,480,480,510],['beach-sandals',1040,560,480,400]];
for(const [id,left,top,width,height]of sprites){const crop=await sharp(source).extract({left,top,width,height}).png().toBuffer();await sharp(crop).trim().resize(96,96,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(out+'equipment-'+id+'.png');}
await writeFile(out+'manifest.json',JSON.stringify({equipment:sprites.map(([id])=>'equipment-'+id)},null,2)+'\n');
