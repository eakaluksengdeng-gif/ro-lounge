import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
mkdirSync('data/cat-identity',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{const p=await browser.newPage({viewport:{width:1120,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 const result=await p.evaluate(async()=>{
  const {loadReferenceArt,artImage}=await import('/src/reference/Assets.ts');await loadReferenceArt();const {catCanvas,CAT_POSES,CAT_COATS}=await import('/src/nature/CatArt.ts'),{buildNatureTextures}=await import('/src/nature/art.ts');
  const textures=new Map(),scene={textures:{exists:k=>textures.has(k),addCanvas(k,c){textures.set(k,c);return{setFilter(){}};}}};buildNatureTextures(scene);
  const palette=CAT_COATS.map(row=>row.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(','))),equal=(a,b)=>a.toDataURL()===b.toDataURL();let valid=true,changed=0;const feet=[];
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#f7efd8;overflow:auto;color:#35553c;font:16px sans-serif';
  const title=document.createElement('h2');title.textContent='ONE CAT IDENTITY · walk / sit / groom / stretch / sleep';document.body.append(title);
  for(let variant=0;variant<3;variant++){const row=document.createElement('div');row.style.cssText='display:flex;gap:20px;padding:10px';for(const pose of CAT_POSES){
    const canvas=catCanvas(pose,variant),key=pose.startsWith('walk-')?`nature-cat-${variant}-${pose.at(-1)}`:`nature-cat-${variant}-${pose}`;valid&&=equal(textures.get(key),canvas);
    const base=catCanvas(pose,0).getContext('2d').getImageData(0,0,48,48).data,data=canvas.getContext('2d').getImageData(0,0,48,48).data;let foot=-1;
    for(let i=0;i<data.length;i+=4){if(data[i+3])foot=Math.max(foot,Math.floor(i/4/48));if(variant&&[0,1,2].some(j=>base[i+j]!==data[i+j])){changed++;const a=Array.from(base.slice(i,i+3)).join(','),b=Array.from(data.slice(i,i+3)).join(',');const level=palette[0].indexOf(a);if(level<0||palette[variant][level]!==b)valid=false;}}
    feet.push(foot);const cell=document.createElement('div');cell.style.cssText='text-align:center;width:150px';canvas.style.cssText='display:block;width:144px;height:144px;image-rendering:pixelated';cell.append(canvas,pose);row.append(cell);
   }document.body.append(row);}
  // The dock-cat edit must not repaint the fishing scene outside its tiny rectangle.
  const raw=key=>{const c=document.createElement('canvas');c.width=720;c.height=540;c.getContext('2d').drawImage(artImage(key),0,0,720,540);return c.getContext('2d').getImageData(0,0,720,540).data;};const a=raw('activity-cove'),b=raw('cat-v2-cove');let changedOutside=0,changedInside=0;
  for(let y=0;y<540;y++)for(let x=0;x<720;x++){const i=(y*720+x)*4;if([0,1,2,3].some(j=>a[i+j]!==b[i+j])){if(x>=587&&x<659&&y>=218&&y<294)changedInside++;else changedOutside++;}}
  return{valid,changed,feet,changedOutside,changedInside,unique:new Set(CAT_POSES.map(p=>catCanvas(p).toDataURL())).size};
 });assert.equal(result.valid,true,'walking and rest use the SAME canonical model/palette; non-fur pixels unchanged');assert.ok(result.changed>100);assert.equal(result.unique,6);assert.ok(result.feet.every(f=>f>=40&&f<=42));assert.equal(result.changedOutside,0);assert.ok(result.changedInside>100);assert.deepEqual(errors,[]);await p.screenshot({path:'data/cat-identity/model-sheet.png',fullPage:true});console.log('PASS canonical identity all6 poses ×3 coats, only fur recolored, stable feet, no fishing scene edits outside cat rectangle',result);
}finally{await browser.close();}
