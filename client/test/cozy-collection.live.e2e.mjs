import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const url=process.env.E2E_URL??'http://127.0.0.1:5173',out=resolve(process.env.RO_QA_OUTPUT??'data/cozy-collection-live');mkdirSync(out,{recursive:true});
const report={url,checks:[],errors:[],missing:[],phase:'running'},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:864}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/art/')&&r.status()>=400)report.missing.push(r.url());});
 await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.cozyArtVersion==='cozy-v3');
 const art=await page.request.get(new URL('/art/cozy-v3/fountain-garden.png',url).href);assert.equal(art.status(),200);report.checks.push('new generated fountain and cozy-v3 assets decoded');
 await page.locator('#nameInput').fill('Cozy Bag QA');await page.getByRole('button',{name:'เข้าเมือง',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#worldToolbar strong')?.textContent==='เมืองกลาง',null,{timeout:90000});await page.waitForTimeout(800);
 assert.equal(await page.locator('#worldBagButton canvas').count(),1);await page.screenshot({path:join(out,'town.png')});
 await page.mouse.click(430,460);await page.waitForFunction(()=>{const b=document.querySelector('#worldInteract');return b&&!b.hidden&&!b.disabled&&/จับผีเสื้อ|จับผึ้ง|จับเต่าทอง/.test(b.textContent);},null,{timeout:35000});
 await page.locator('#worldInteract').click();await page.waitForFunction(()=>document.querySelector('#worldToast')?.textContent.includes('สำเร็จ +1'),null,{timeout:20000});
 assert.equal(await page.locator('#worldPanel').isVisible(),false);await page.waitForFunction(()=>document.querySelector('#worldBagButton .bag-count')?.textContent==='1');
 report.checks.push('actual nearby roaming bug captured without modal; real bag count becomes one');
 await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();await page.getByRole('button',{name:'แมลง',exact:true}).click();
 await page.locator('.collection-book [data-item]').filter({hasText:'× 1'}).first().click();assert.match(await page.locator('.collection-inspector').innerText(),/ในกระเป๋า × 1/);
 await page.waitForTimeout(2600);await page.screenshot({path:join(out,'collection.png')});
 for(const width of [390,320]){await page.setViewportSize({width,height:864});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(out,'collection-'+width+'.png')});}
 await page.reload();await page.getByRole('button',{name:'เข้าเมือง',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#worldBagButton .bag-count')?.textContent==='1',null,{timeout:90000});
 assert.equal(await page.locator('#casinoToolbar .gold-balance').getAttribute('data-balance'),'100');
 await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();await page.getByRole('button',{name:'แมลง',exact:true}).click();assert.equal(await page.locator('.collection-book [data-item]').filter({hasText:'× 1'}).count(),1);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.checks.push('category and item inspection, 390/320px, reconnect retains the catch, wallet unchanged at 100');report.phase='passed';console.log('PASS black-box cozy fountain/backpack, live roaming catch, inspection, mobile and durable reload with unchanged wallet');
}catch(error){report.phase='failed';report.error=String(error);throw error;}finally{writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();}
