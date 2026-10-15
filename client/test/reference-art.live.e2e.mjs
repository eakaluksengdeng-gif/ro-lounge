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
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(/\/art\/(reference-v1|activity-v2)\//.test(r.url())&&r.status()!==200)report.missing.push(r.url());});
  const versionBefore=await page.request.get('https://ro-lounge.onrender.com/version').then(r=>r.json());
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.artVersion==='reference-v1');
  await page.waitForFunction(()=>document.documentElement.dataset.activityArtVersion==='activity-v2');
  const manifest=await page.request.get(new URL('/art/reference-v1/manifest.json',url).href).then(r=>r.json());assert.equal(Object.values(manifest).filter(Array.isArray).flat().length,140);
  await page.screenshot({path:join(output,'creator.png'),fullPage:true});
  await page.locator('#nameInput').fill('Reference Art QA');await page.getByRole('button',{name:'เข้าเมือง',exact:true}).click();
  await page.locator('#worldToolbar').waitFor({timeout:90000});await page.waitForFunction(()=>document.querySelector('#casinoToolbar .gold-balance')?.dataset.balance==='100');
  await page.screenshot({path:join(output,'town.png')});report.checks.push('140 production assets decoded; creator and live town joined');
  const maps=[['ป่าน้ำตก','forest'],['เมืองกลาง','town'],['ฟาร์มเพื่อนรัก','farm'],['เมืองกลาง','town'],['หาดสายลม','beach'],['เมืองกลาง','town'],['ตลาดโคมไฟ','market'],['เมืองกลาง','town']];
  for(const [name,id]of maps){await page.getByRole('button',{name:'🧭 แผนที่',exact:true}).click();await page.getByRole('button',{name:new RegExp('เดินไป'+name)}).click();
    await page.waitForFunction(text=>document.querySelector('#worldToolbar strong')?.textContent===text,name,{timeout:45000});await page.waitForTimeout(500);
    await page.screenshot({path:join(output,id+'.png')});report.checks.push('actual navigation and rendered '+id);
    if(id==='market'){
      await page.mouse.click(430,540);await page.waitForFunction(()=>{const button=document.querySelector('#worldInteract');return button&&!button.hidden&&button.textContent.includes('คาเฟ่');},null,{timeout:25000});
      await page.locator('#worldInteract').click();assert.equal(await page.locator('.cafe-orders progress').count(),4);assert.ok(await page.locator('.world-cafe-worker canvas').count()<=4);
      await page.screenshot({path:join(output,'cafe.png'),fullPage:true});await page.locator('#worldPanel').getByRole('button',{name:'ปิด',exact:true}).click();report.checks.push('read-only live cafe tableau and four stage progress bubbles');
    }
  }
  // Owner-only cast is cancelled: validate the sitting scene/gauge without minting fish/chips.
  await page.getByRole('button',{name:'🐟 ไปบ่อตกปลา',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#fishingPanel')?.dataset.near==='true',null,{timeout:25000});
  await page.locator('#fishAction').click();await page.waitForFunction(()=>document.querySelector('#fishingPanel')?.dataset.phase==='waiting');
  assert.equal(await page.locator('#fishingPanel').getAttribute('data-sitting'),'true');assert.equal(await page.locator('#fishingScene').isVisible(),true);
  await page.waitForFunction(()=>document.querySelector('#fishingPanel')?.dataset.phase==='bite',null,{timeout:15000});
  await page.screenshot({path:join(output,'fishing.png')});assert.equal(await page.locator('#fishSkillGauge').isVisible(),true);
  await page.locator('#fishCancel').click();await page.waitForFunction(()=>document.querySelector('#fishingPanel')?.dataset.phase==='idle',null,{timeout:10000});
  report.checks.push('authoritative sitting fishing scene/red target; own cast cancelled with no reward');
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
