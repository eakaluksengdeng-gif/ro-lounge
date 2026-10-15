import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const url=process.env.E2E_URL??'https://ro-lounge.vercel.app/';
const output=resolve(process.env.RO_QA_OUTPUT??'data/reference-art-live');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={url,startedAt:new Date().toISOString(),phase:'running',checks:[],errors:[],missing:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:864}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/art/reference-v1/')&&r.status()!==200)report.missing.push(r.url());});
  const versionBefore=await page.request.get('https://ro-lounge.onrender.com/version').then(r=>r.json());
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.artVersion==='reference-v1');
  const manifest=await page.request.get(new URL('/art/reference-v1/manifest.json',url).href).then(r=>r.json());assert.equal(Object.values(manifest).filter(Array.isArray).flat().length,140);
  await page.screenshot({path:join(output,'creator.png'),fullPage:true});
  await page.locator('#nameInput').fill('Reference Art QA');await page.getByRole('button',{name:'เข้าเมือง',exact:true}).click();
  await page.locator('#worldToolbar').waitFor({timeout:90000});await page.waitForFunction(()=>document.querySelector('#casinoToolbar .gold-balance')?.dataset.balance==='100');
  await page.screenshot({path:join(output,'town.png')});report.checks.push('140 production assets decoded; creator and live town joined');
  const maps=[['ป่าน้ำตก','forest'],['เมืองกลาง','town'],['ฟาร์มเพื่อนรัก','farm'],['เมืองกลาง','town'],['หาดสายลม','beach'],['เมืองกลาง','town'],['ตลาดโคมไฟ','market'],['เมืองกลาง','town']];
  for(const [name,id]of maps){await page.getByRole('button',{name:'🧭 แผนที่',exact:true}).click();await page.getByRole('button',{name:new RegExp('เดินไป'+name)}).click();
    await page.waitForFunction(text=>document.querySelector('#worldToolbar strong')?.textContent===text,name,{timeout:45000});await page.waitForTimeout(500);
    await page.screenshot({path:join(output,id+'.png')});report.checks.push('actual navigation and rendered '+id);
  }
  await page.getByRole('button',{name:'สมุดสะสม',exact:true}).click();await page.locator('.collection-tabs').getByRole('button',{name:'ปลา',exact:true}).click();assert.equal(await page.locator('.world-collection article').count(),7);
  await page.screenshot({path:join(output,'collection.png'),fullPage:true});await page.locator('#worldPanel').getByRole('button',{name:'ปิด',exact:true}).click();
  // Spectator only: never sit/bet/start, collect items or join another player's kitchen.
  await page.getByRole('button',{name:'♠ ไป Boardgame',exact:true}).click();await page.locator('#casino').waitFor({state:'visible',timeout:45000});
  assert.equal(await page.locator('[data-table-seat]').count(),8);await page.screenshot({path:join(output,'boardgame.png'),fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(output,'boardgame-'+width+'.png'),fullPage:true});}
  await page.getByRole('button',{name:'ออกสู่เมือง',exact:true}).click();await page.locator('#casino').waitFor({state:'hidden'});
  assert.equal(await page.locator('#casinoToolbar .gold-balance').getAttribute('data-balance'),'100');
  const versionAfter=await page.request.get('https://ro-lounge.onrender.com/version').then(r=>r.json());assert.equal(versionBefore.commit,versionAfter.commit);assert.equal(versionAfter.durableStorage,true);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.checks.push('collection raster icons/filter, eight-seat inn UI, 390/320px, unchanged wallet 100 and unchanged durable backend');
  report.phase='passed';report.backend=versionAfter;console.log('PASS: production reference art, all five live maps, collection, Boardgame spectator/mobile, unchanged balance/backend, no missing assets/page errors');
}catch(error){report.phase='failed';report.failure=String(error);throw error;}
finally{report.finishedAt=new Date().toISOString();writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));await browser.close();}
