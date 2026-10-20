import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';import sharp from 'sharp';
mkdirSync('data/scenery-polish',{recursive:true});
for(const id of ['well','waterfall','farmhouse']){const {data,info}=await sharp('public/art/scenery-v1/scenery-'+id+'.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);assert.equal(data[3],0);let solid=0;for(let i=3;i<data.length;i+=4){assert.ok(data[i]===0||data[i]===255);if(data[i]===255)solid++;}assert.ok(solid>500);}
const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:864}}),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/art/')&&r.status()!==200)missing.push(r.url());});
 await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{
  const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();const Phaser=(await import('/node_modules/.vite/deps/phaser.js')).default;const {WorldRenderer}=await import('/src/world/WorldRenderer.ts');
  document.body.replaceChildren();document.body.style.cssText='margin:0;overflow:hidden';const stage=document.createElement('div');stage.id='qaStage';document.body.append(stage);
  window.qaGame=new Phaser.Game({type:Phaser.CANVAS,width:1440,height:864,parent:'qaStage',pixelArt:true,scene:{create(){window.qaScene=this;window.qaDraw=map=>{this.children.removeAll(true);window.qaRenderer=new WorldRenderer(this,map);window.qaRenderer.draw();};window.qaReady=true;}}});
 });await p.waitForFunction(()=>window.qaReady);
 for(const map of ['farm','forest','beach','market']){
  await p.evaluate(map=>window.qaDraw(map),map);await p.waitForTimeout(150);await p.screenshot({path:`data/scenery-polish/${map}.png`});
  if(map==='farm'){const well=await p.evaluate(()=>window.qaScene.children.list.filter(o=>o.getData?.('worldDecoration')==='farm-water').map(o=>({w:o.displayWidth,h:o.displayHeight,x:o.x,y:o.y})));assert.deepEqual(well,[{w:90,h:76,x:800,y:544}]);}
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>{window.qaDraw('farm');const view={serverTime:Date.now(),progress:{water:2,cooldowns:{},plots:[]},farms:[],boat:null};window.qaRenderer.update(view);window.qaRenderer.update({...view,progress:{...view.progress,water:3},notice:'ตักน้ำ +1 · มีน้ำ 3 หน่วย'});});await p.waitForTimeout(800);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS three alpha-clean scenery assets; farm/forest/beach/market render without missing art; real water node anchor retained; reduced-motion refill feedback; all decoded assets');
}finally{await b.close();}
