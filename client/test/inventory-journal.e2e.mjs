import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();const {WorldUI}=await import('/src/world/WorldUI.ts');
  document.body.replaceChildren();const callbacks=new Map(),sent=[],player={playerId:'p',mapId:'town',x:720,y:432};
  const room={sessionId:'s',state:{players:new Map([['s',player]])},onMessage(type,fn){callbacks.set(type,fn);},onLeave(){},send(type,body){sent.push({type,body});}};
  const scene={casinoOpen:false,worldOpen:false,setWorldView(){},stopNavigation(){}};
  const ui=new WorldUI(room,scene),view={map:'town',progress:{map:'town',water:0,inventory:{mushroom:0,shell:2,beetle:1,carrot:2,chef:50,'animal-friend':5},discovered:['mushroom','shell','beetle','carrot','chef','animal-friend'],plots:[],unlocks:['none','camp-hat'],equipped:'none',allowHelp:false,cooldowns:{}},farms:[],cafe:{phase:'lobby',members:[]},cleanup:0,boat:null};
  callbacks.get('world:state')(view);callbacks.get('fish:state')({inventory:{carp:3}});window.qa={ui,view,callbacks,sent};
 });
 await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();assert.equal(await page.locator('#worldPanel h2').innerText(),'กระเป๋าของฉัน');
 assert.deepEqual((await page.locator('[data-item]').evaluateAll(els=>els.map(e=>e.dataset.item))).sort(),['beetle','carp','carrot','shell']);
 await page.waitForFunction(()=>document.querySelector('#worldBagButton .bag-count')?.textContent==='8');assert.equal(await page.locator('.collection-summary progress').count(),0);assert.match(await page.locator('.inventory-resources').innerText(),/น้ำส่วนตัว 0/);
 await page.getByRole('searchbox',{name:'ค้นหาของในกระเป๋า'}).fill('หอย');assert.equal(await page.locator('[data-item]').count(),1);assert.equal(await page.locator('[data-item]').getAttribute('data-item'),'shell');
 await page.getByRole('searchbox').fill('เห็ด');assert.equal(await page.locator('[data-item]').count(),0);await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();
 await page.getByRole('combobox',{name:'เรียงของในกระเป๋า'}).selectOption('quantity');assert.equal(await page.locator('[data-item]').first().getAttribute('data-item'),'carp');
 await page.getByRole('button',{name:'แครอท จำนวน 2',exact:true}).click();const uses=(await page.locator('.inventory-uses').allTextContents()).join(' ');assert.match(uses,/หมวกฟาง/);assert.match(uses,/2\/2/);assert.match(uses,/ออร์เดอร์/);
 assert.equal(await page.locator('.wardrobe [data-gear=camp-hat]').count(),1);assert.equal(await page.locator('.wardrobe [data-gear=straw-hat]').count(),0);assert.equal(await page.locator('.wardrobe-slot').count(),5);
 for(const width of [1200,768,390,320]){await page.setViewportSize({width,height:864});await page.waitForTimeout(150);assert.equal(await page.locator('.world-frame').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/ro-real-inventory-'+width+'.png'});}
 await page.getByRole('button',{name:'เปิดสมุดสะสม',exact:true}).click();assert.equal(await page.locator('#worldPanel h2').innerText(),'สมุดสะสม');assert.equal(await page.locator('.inventory-tools').count(),0);
 const mushroom=page.getByRole('button',{name:'เห็ดป่า ค้นพบแล้ว',exact:true});assert.equal(await mushroom.count(),1);await mushroom.click();assert.match(await page.locator('.collection-inspector').innerText(),/ตอนนี้ไม่มีของชิ้นนี้/);
 await page.getByRole('button',{name:'ร่วมเสิร์ฟสำเร็จ ค้นพบแล้ว',exact:true}).click();assert.match(await page.locator('.collection-inspector').innerText(),/ไม่ใช่สิ่งของ/);
 assert.equal(await page.locator('.collection-count').filter({hasText:'× 0'}).count(),0);
 await page.getByRole('button',{name:'ยังไม่พบ',exact:true}).click();assert.equal(await page.getByRole('button',{name:'เห็ดป่า ค้นพบแล้ว',exact:true}).count(),0);
 await page.getByRole('button',{name:'ทั้งหมดที่บันทึก',exact:true}).click();assert.equal(await mushroom.count(),1);
 await page.getByRole('button',{name:'เปิดกระเป๋าของจริง',exact:true}).click();
 await page.evaluate(()=>{const q=window.qa;q.view.progress.inventory={mushroom:0,chef:50};q.callbacks.get('world:state')(q.view);q.callbacks.get('fish:state')({inventory:{}});});
 assert.equal(await page.locator('[data-item]').count(),0);assert.match(await page.locator('.inventory-empty').innerText(),/ยังไม่มีของ/);await page.waitForFunction(()=>document.querySelector('#worldBagButton .bag-count')?.textContent==='0');
 assert.deepEqual(errors,[]);console.log('PASS physical bag vs permanent journal, zero/spent/records excluded, correct badge, fish, search/filter/sort, real recipe hints, owned gear, empty state, 1200/768/390/320');
}finally{await browser.close();}
