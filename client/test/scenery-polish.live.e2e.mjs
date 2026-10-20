import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const url=process.env.E2E_URL??'http://127.0.0.1:5173';mkdirSync('data/scenery-polish/live',{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await b.newPage({viewport:{width:1440,height:864}}),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/art/')&&r.status()!==200)missing.push(r.url());});
 const join=async()=>{await p.getByRole('button',{name:'เข้าเมือง',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#casinoToolbar .gold-balance')?.dataset.balance==='100',null,{timeout:90000});};
 const close=()=>p.locator('#worldPanel').getByRole('button',{name:'ปิด',exact:true}).click();
 await p.goto(url,{waitUntil:'networkidle'});await p.locator('#nameInput').fill('Scenery Water QA');await join();
 await p.getByRole('button',{name:'🧭 แผนที่',exact:true}).click();await p.getByRole('button',{name:/เดินไปฟาร์มเพื่อนรัก/}).click();await p.waitForFunction(()=>document.querySelector('#worldToolbar strong')?.textContent==='ฟาร์มเพื่อนรัก',null,{timeout:45000});
 await p.getByRole('button',{name:'กิจกรรมใกล้ตัว',exact:true}).click();await p.locator('[data-nearby-action=farm-water]').click();
 await p.waitForFunction(()=>{const e=document.getElementById('worldInteract');return e&&!e.hidden&&!e.disabled&&e.textContent.includes('ตักน้ำ +1 · น้ำ 2');},null,{timeout:45000});
 await p.screenshot({path:'data/scenery-polish/live/well-before.png'});await p.locator('#worldInteract').click();await p.waitForFunction(()=>document.querySelector('#worldToast')?.textContent.includes('มีน้ำ 3 หน่วย'));
 await p.getByRole('button',{name:'กระเป๋า',exact:true}).click();assert.match(await p.locator('.inventory-resources').innerText(),/น้ำส่วนตัว 3 หน่วย/);assert.equal(await p.locator('.inventory-resources>canvas').count(),1);await close();
 await p.reload({waitUntil:'networkidle'});await join();await p.getByRole('button',{name:'กระเป๋า',exact:true}).click();assert.match(await p.locator('.inventory-resources').innerText(),/น้ำส่วนตัว 3 หน่วย/);await close();
 for(const width of [390,320]){await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:`data/scenery-polish/live/farm-${width}.png`});}
 assert.equal(await p.locator('#casinoToolbar .gold-balance').getAttribute('data-balance'),'100');assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS live farm well at original node, real server refill 2→3, pixel inventory water, reload persistence, 390/320px, wallet100 unchanged, no missing art or page errors');
}finally{await b.close();}
