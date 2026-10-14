import { chromium } from "playwright";
import assert from "node:assert/strict";

// Black-box browser test: no DEV hook, server override, teleport or privileged API.
// Uses only isolated Guests. Optional stdin gate lets the operator verify a real server restart.
const url=process.env.E2E_URL??"http://127.0.0.1:5173";
const browser=await chromium.launch({channel:"chrome",headless:true});
const contexts=[],errors=[];
async function guest(name){
  const context=await browser.newContext({viewport:{width:1440,height:864}});contexts.push(context);
  const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
  await page.goto(url);await page.locator("#nameInput").fill(name);await page.getByRole("button",{name:"เข้าเมือง",exact:true}).click();
  await page.locator("#worldToolbar").waitFor({timeout:90000});
  await page.waitForFunction(()=>document.querySelector("#casinoToolbar .gold-balance")?.dataset.balance==="100");return page;
}
async function close(page){if(await page.locator("#worldPanel").isVisible())await page.locator("#worldPanel").getByRole("button",{name:"ปิด",exact:true}).click();}
async function map(page,name){
  await close(page);await page.getByRole("button",{name:"🧭 แผนที่",exact:true}).click();
  await page.getByRole("button",{name:new RegExp("เดินไป"+name)}).click();
  await page.waitForFunction(name=>document.querySelector("#worldToolbar strong")?.textContent===name,name,{timeout:30000});await page.waitForTimeout(500);
}
async function activity(page,x,y,name){
  await close(page);await page.mouse.click(x,y);
  await page.waitForFunction(name=>{const b=document.querySelector("#worldInteract");return b&&!b.hidden&&b.textContent.includes(name);},name,{timeout:20000});
  await page.locator("#worldInteract").click();await page.locator("#worldPanel").waitFor({state:"visible"});
}
async function action(page,name,notice){
  await page.locator("#worldPanel").getByRole("button",{name,exact:true}).click();
  await page.waitForFunction(text=>document.querySelector("#worldNotice")?.textContent.includes(text),notice,{timeout:20000});
}
async function bag(page){await close(page);await page.getByRole("button",{name:"กระเป๋า",exact:true}).click();await page.locator("#worldPanel").waitFor({state:"visible"});}
async function fish(page){
  await close(page);await page.getByRole("button",{name:"🐟 ไปบ่อตกปลา",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector("#fishingPanel")?.dataset.near==="true",null,{timeout:20000});
  for(let attempt=0;attempt<5;attempt++){
    await page.waitForFunction(()=>document.querySelector("#fishingPanel")?.dataset.phase==="idle",null,{timeout:15000});
    await page.locator("#fishAction").click();
    await page.waitForFunction(()=>document.querySelector("#fishingPanel")?.dataset.phase==="bite",null,{timeout:15000});
    await page.waitForFunction(()=>{const g=document.querySelector("#fishSkillGauge");const p=Number(g?.dataset.position);return p>.46&&p<.54;},null,{timeout:8000});
    await page.keyboard.press("Space");
    await page.waitForFunction(()=>document.querySelector("#fishingPanel")?.dataset.phase==="result");
    if((await page.locator("#fishingPanel p").innerText()).includes("ชิป"))return;
  }
  throw new Error("No successful authoritative catch in five attempts");
}
try{
  const a=await guest("World Live Owner"),b=await guest("World Live Friend");
  const sessions=await Promise.all([a,b].map(p=>p.evaluate(()=>localStorage.getItem("ro-guest-session"))));
  assert.notEqual(sessions[0],sessions[1]);
  await fish(a);const balance=await a.locator("#casinoToolbar .gold-balance").getAttribute("data-balance");assert.ok(Number(balance)>100&&Number(balance)<=120);
  await map(a,"ป่าน้ำตก");await activity(a,360,560,"เก็บเห็ด");await action(a,"เก็บเห็ด","สำเร็จ");
  await a.screenshot({path:"/tmp/ro-world-live-forest.png"});
  await map(a,"เมืองกลาง");await map(a,"ฟาร์มเพื่อนรัก");
  await activity(a,490,460,"แปลงผัก");await a.getByRole("button",{name:"ปลูกแครอท",exact:true}).first().click();
  await a.waitForFunction(()=>document.querySelector("#worldNotice")?.textContent.includes("ปลูกแครอท"));
  await a.getByRole("button",{name:"รดน้ำ",exact:true}).first().click();await a.waitForFunction(()=>document.querySelector("#worldNotice")?.textContent.includes("รดน้ำแล้ว"));
  await map(a,"เมืองกลาง");await map(a,"หาดสายลม");await activity(a,700,540,"หอยมุก");await action(a,"เก็บหอยมุก","สำเร็จ");
  await map(a,"เมืองกลาง");await map(a,"ตลาดโคมไฟ");await map(b,"ตลาดโคมไฟ");
  await Promise.all([activity(a,430,540,"คาเฟ่"),activity(b,430,540,"คาเฟ่")]);
  await action(a,"เข้าทีม","เข้าทีม");await action(b,"เข้าทีม","เข้าทีม");
  await a.getByRole("button",{name:"เริ่มครัว",exact:true}).waitFor();await a.waitForTimeout(1200);await action(a,"เริ่มครัว","เริ่มครัว");
  const stations=["รับออร์เดอร์","เตรียม","ปรุง","เสิร์ฟ"],notices=["รับออร์เดอร์แล้ว","เตรียมวัตถุดิบแล้ว","ปรุงแล้ว","เสิร์ฟแล้ว"];
  for(let i=0;i<12;i++){
    const p=i%2?a:b,button=p.getByRole("button",{name:stations[i%4]+" ← ตอนนี้",exact:true});
    await button.waitFor();await button.click();await p.waitForFunction(text=>document.querySelector("#worldNotice")?.textContent.includes(text),notices[i%4]);await p.waitForTimeout(900);
  }
  await a.screenshot({path:"/tmp/ro-world-live-cafe.png"});await action(a,"ออกจากทีม","ออกจากทีม");await action(b,"ออกจากทีม","ออกจากทีม");
  await activity(a,1020,500,"ร้านแลกชุด");
  await a.locator(".world-collection article").filter({hasText:"หมวกเชฟ"}).getByRole("button",{name:"ยืนยันแลก",exact:true}).click();
  await a.waitForFunction(()=>document.querySelector("#worldNotice")?.textContent.includes("ปลดล็อก"));
  await bag(a);assert.match(await a.locator("#worldPanel").innerText(),/หมวกเชฟ ✓/);
  assert.match(await a.locator(".world-collection article").filter({hasText:"เห็ดป่า"}).innerText(),/ของป่า · 1/);
  assert.match(await a.locator(".world-collection article").filter({hasText:"หอยมุก"}).innerText(),/ชายหาด · 1/);
  for(const width of [1280,768,390,320]){await a.setViewportSize({width,height:864});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  if(process.env.E2E_RESTART_CHECK==="1"){
    console.log("READY_FOR_SERVER_RESTART: five maps, real catch/wallet, farm, two-player cafe, collection and outfit saved; send newline after backend is healthy");
    process.stdin.resume();await new Promise(resolve=>process.stdin.once("data",resolve));process.stdin.pause();
  }
  await a.reload();await a.getByRole("button",{name:"เข้าเมือง",exact:true}).click();await a.locator("#worldToolbar").waitFor({timeout:90000});
  await a.waitForFunction(value=>document.querySelector("#casinoToolbar .gold-balance")?.dataset.balance===value,balance);
  assert.equal(await a.evaluate(()=>localStorage.getItem("ro-guest-session")),sessions[0]);
  await bag(a);assert.match(await a.locator("#worldPanel").innerText(),/หมวกเชฟ ✓/);
  assert.match(await a.locator(".world-collection article").filter({hasText:"เห็ดป่า"}).innerText(),/ของป่า · 1/);
  await close(a);await a.setViewportSize({width:1440,height:864});await map(a,"เมืองกลาง");await map(a,"ฟาร์มเพื่อนรัก");await activity(a,490,460,"แปลงผัก");
  assert.match(await a.locator("#worldPanel").innerText(),/แครอท/);assert.match(await a.locator("#worldPanel").innerText(),/รดน้ำแล้ว/);
  assert.deepEqual(errors,[]);
  console.log("PASS: "+url+" black-box production-compatible five-map browser play, catch and non-default wallet, crops, 2-player cafe, cosmetics, collection, four viewport sizes and saved identity/progress after "+(process.env.E2E_RESTART_CHECK==="1"?"server restart":"reload"));
}catch(error){for(const [i,c]of contexts.entries())for(const p of c.pages())await p.screenshot({path:"/tmp/ro-world-live-failure-"+i+".png"}).catch(()=>{});throw error;}
finally{await browser.close();}
