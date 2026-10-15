import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 const result=await page.evaluate(async()=>{const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();const {buildNatureTextures}=await import('/src/nature/art.ts');const textures=new Map(),scene={textures:{exists:key=>textures.has(key),addCanvas(key,canvas){textures.set(key,canvas);return{setFilter(){}};}}};buildNatureTextures(scene);const rows=[];for(const pose of ['sit','groom','stretch','sleep'])rows.push(new Set([0,1,2].map(v=>textures.get(`nature-cat-${v}-${pose}`).toDataURL())).size);return rows;});assert.deepEqual(result,[3,3,3,3]);console.log('PASS each cat retains its own coat variant through all four rest poses');
}finally{await browser.close();}
