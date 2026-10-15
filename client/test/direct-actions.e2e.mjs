import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();
  const {WorldUI}=await import('/src/world/WorldUI.ts');const {NatureUI}=await import('/src/nature/NatureUI.ts');
  document.body.replaceChildren();const callbacks=new Map(),sent=[];
  const player={playerId:'p',name:'QA',mapId:'forest',x:1080,y:550,color:0x78d9ec,hair:0,skin:0,pants:0,style:0,gender:0};
  const room={sessionId:'s',state:{players:new Map([['s',player]]),wildlife:new Map()},send(type,body){sent.push({type,body});},onLeave(){},onMessage(type,fn){const list=callbacks.get(type)||[];list.push(fn);callbacks.set(type,list);}};
  const scene={casinoOpen:false,worldOpen:false,stopNavigation(){},setWorldView(){},navigateTo(){}};
  const ui=new WorldUI(room,scene),nature=new NatureUI(room,scene);
  const emit=(type,value)=>callbacks.get(type)?.forEach(fn=>fn(value));
  const view={map:'forest',progress:{map:'forest',water:2,inventory:{beetle:1},discovered:['beetle'],plots:Array(6).fill(null),allowHelp:false,unlocks:['none'],equipped:'none',cooldowns:{}},farms:[],cleanup:0,boat:null,cafe:{phase:'lobby',members:[],host:null,deadline:null,order:0,served:0,recipe:'salad',roundId:null}};
  emit('world:state',view);window.qa={ui,nature,emit,sent,scene,player,view};
 });
 await page.locator('#worldInteract').click();
 assert.equal(await page.locator('#worldPanel').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.qa.sent.at(-1).body.verb),'collect');
 await page.evaluate(()=>{const q=window.qa;q.emit('world:state',{...q.view,notice:'จับด้วงทองสำเร็จ +1'});});
 assert.equal(await page.locator('#worldToast').isVisible(),true);
 await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();
 for(const width of [1100,390,320]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/ro-modern-inventory-'+width+'.png'});}
 await page.getByRole('button',{name:'ปิด',exact:true}).click();
 await page.evaluate(()=>{const q=window.qa;q.player.mapId='beach';q.player.x=720;q.player.y=602;q.nature.render();q.emit('fish:state',{phase:'idle',castId:null,serverTime:Date.now(),inventory:{},total:0});});
 await page.locator('#fishAction').click();
 let count=await page.evaluate(()=>window.qa.sent.filter(x=>x.type==='fish:cast').length);assert.equal(count,1);
 await page.evaluate(()=>{const q=window.qa;for(const phase of ['waiting','bite','result','idle'])q.emit('fish:state',{phase,castId:'cast-1',serverTime:Date.now(),inventory:{},total:0,biteStartedAt:Date.now(),deadline:Date.now()+8000});});
 assert.equal(await page.evaluate(()=>window.qa.sent.filter(x=>x.type==='fish:cast').length),2);
 assert.equal(await page.evaluate(()=>window.qa.sent.filter(x=>x.type==='fish:reel').length),0,'never automatically reel');
 await page.locator('#fishCancel').click();
 await page.evaluate(()=>window.qa.emit('fish:state',{phase:'idle',serverTime:Date.now(),inventory:{},total:0}));await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.qa.sent.filter(x=>x.type==='fish:cast').length),2,'stop stays stopped');
 assert.deepEqual(errors,[]);console.log('PASS direct catch without modal, visual inventory responsive 1100/390/320, continuous recast/manual reel/stop');
}finally{await browser.close();}
