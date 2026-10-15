import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=new URL('../art-source/cozy-v3/fountain-garden.png',import.meta.url),out=new URL('../public/art/cozy-v3/',import.meta.url);
await mkdir(out,{recursive:true});
// Preserve the actual generated alpha; nearest-neighbour preparation for the game sprite.
await sharp(fileURLToPath(source)).trim().resize({width:256,height:256,fit:'inside',kernel:'nearest'}).png().toFile(fileURLToPath(new URL('fountain-garden.png',out)));
await sharp(fileURLToPath(new URL('../art-source/cozy-v3/water-ripples.png',import.meta.url))).resize(128,128,{kernel:'nearest'}).png().toFile(fileURLToPath(new URL('water-ripples.png',out)));
await writeFile(new URL('manifest.json',out),JSON.stringify({version:'cozy-v3',props:['fountain-garden'],tiles:['water-ripples']},null,2)+'\n');
console.log('Prepared cozy-v3 fountain from retained original');
