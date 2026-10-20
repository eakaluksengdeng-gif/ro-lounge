import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('data/village-menu',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:864}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();const {WorldUI}=await import('/src/world/WorldUI.ts');
  document.body.replaceChildren();const callbacks=new Map(),sent=[],routes=[];
  const person={playerId:'a',name:'A',mapId:'town',x:720,y:530,color:0x78d9ec,hair:0,skin:0,pants:0,style:0,gender:0};
  const room={sessionId:'s',state:{players:new Map([['s',person]])},onLeave(){},send(type,body){sent.push({type,body});},onMessage(type,fn){callbacks.set(type,fn);}};
  const scene={casinoOpen:false,worldOpen:false,setWorldView(){},stopNavigation(){},navigateTo(points){routes.push(points);}};
  new WorldUI(room,scene);window.qa={sent,routes,person,scene,callbacks};
  callbacks.get('world:state')({map:'town',serverTime:Date.now(),progress:{map:'town',inventory:{carrot:2},discovered:[],plots:[],water:2,unlocks:['none'],equipped:'none',cooldowns:{},village:{xp:{},completed:[],museum:[]}},farms:[],cafe:{phase:'lobby',members:[]},boat:null,cleanup:0});
 });
 const menu=()=>page.locator('#worldMenuButton').click();const close=()=>page.locator('#worldPanel').getByRole('button',{name:'ปิด',exact:true}).click();
 for(const width of [1200,768,540,430,390,320]){
  await page.setViewportSize({width,height:844});if(width<=540)assert.equal(await page.locator('#worldToolbar button:visible').count(),2);await menu();assert.equal(await page.locator('[data-menu-page]').count(),9);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`data/village-menu/menu-${width}.png`});await close();assert.equal(await page.evaluate(()=>document.activeElement.id),'worldMenuButton');
 }
 await menu();await page.getByRole('button',{name:'บ้านและของแต่ง',exact:true}).click();assert.equal(await page.locator('.menu-catalogue article').count(),6);
 assert.equal(await page.locator('#worldPanel').getByRole('button',{name:/ยืนยัน|สร้าง|จัดวาง/}).count(),0);
 await page.locator('[data-guide-action=home]').click();assert.deepEqual(await page.evaluate(()=>window.qa.routes.at(-1)),[{x:430,y:650}]);
 assert.equal(await page.evaluate(()=>window.qa.sent.some(e=>e.type==='world:action')),false);
 await page.evaluate(()=>{window.qa.person.mapId='forest';});await menu();await page.getByRole('button',{name:'งานหมู่บ้าน',exact:true}).click();await page.locator('[data-guide-action=orders]').click();assert.equal(await page.locator('#worldPanel').getAttribute('data-page'),'map');await close();
 await page.evaluate(()=>{window.qa.person.mapId='town';window.qa.person.x=430;window.qa.person.y=650;});await menu();await page.getByRole('button',{name:'บ้านและของแต่ง',exact:true}).click();assert.equal(await page.locator('[data-guide-action=home]').textContent(),'เปิดใช้งานที่นี่');await page.locator('[data-guide-action=home]').click();assert.equal(await page.locator('#worldPanel').getAttribute('data-page'),'home');await close();
 await menu();await page.getByRole('button',{name:'ตั้งค่า',exact:true}).click();await page.getByLabel('ความดังเพลง',{exact:true}).fill('13');assert.equal(await page.evaluate(()=>localStorage.getItem('ro-music-volume')),'0.13');await page.getByLabel('เล่นเพลง cozy',{exact:true}).uncheck();assert.equal(await page.evaluate(()=>localStorage.getItem('ro-music-muted')),'true');await page.keyboard.press('Escape');
 await page.keyboard.press('m');assert.equal(await page.locator('#worldPanel').getAttribute('data-page'),'menu');await page.keyboard.press('m');assert.equal(await page.locator('#worldPanel').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS nine-entry cozy menu, six responsive layouts, two mobile toolbar buttons, focus return, read-only home/orders previews, same-map walk/cross-map guide, nearby home, persisted audio, M/Escape; no remote world actions');
}finally{await browser.close();}
