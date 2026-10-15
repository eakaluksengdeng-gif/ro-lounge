import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({channel:"chrome",headless:true});
const errors=[],contexts=[];
async function guest(name){
  const context=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(context);const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>window.addEventListener("ro:dev-scene",event=>{window.qaScene=event.detail;}));
  await page.goto("http://127.0.0.1:5173");await page.locator("#nameInput").fill(name);await page.getByRole("button",{name:/เข้าเมือง/}).click();
  await page.waitForFunction(()=>window.qaScene?.room?.state?.players?.get(window.qaScene.room.sessionId));
  await page.evaluate(()=>{const room=window.qaScene.room;window.qaWorld=null;window.qaErrors=[];
    room.onMessage("world:state",state=>window.qaWorld=state);room.onMessage("api:error",error=>window.qaErrors.push(error));room.send("world:sync",{});});
  await page.waitForFunction(()=>window.qaWorld);await page.waitForTimeout(500);return page;
}
const me=page=>page.evaluate(()=>{const s=window.qaScene;const p=s.room.state.players.get(s.room.sessionId);return{x:p.x,y:p.y,map:p.mapId,id:p.playerId,activity:p.activity};});
async function go(page,x,y){
  await page.evaluate(({x,y})=>window.qaScene.room.send("move",{x,y}),{x,y});
  await page.waitForFunction(({x,y})=>{const s=window.qaScene,p=s.room.state.players.get(s.room.sessionId);return Math.hypot(p.x-x,p.y-y)<12;},{x,y},{timeout:15000});
}
async function map(page,destination){
  await page.getByRole("button",{name:"🧭 แผนที่",exact:true}).click();
  await page.getByRole("button",{name:new RegExp("เดินไป"+destination)}).click();
  try {await page.waitForFunction(name=>document.querySelector("#worldToolbar strong")?.textContent===name,destination,{timeout:20000});}
  catch(error){console.log("travel diagnostics",destination,await me(page),await page.evaluate(()=>({route:window.qaScene.route,errors:window.qaErrors,sceneMap:window.qaScene.map})),errors);await page.screenshot({path:"/tmp/ro-world-travel-failure.png"});throw error;}
  await page.waitForTimeout(500);
}
async function activity(page,name){
  await page.waitForFunction(text=>document.querySelector("#worldInteract")?.textContent.includes(text)&&!document.querySelector("#worldInteract").hidden,name);
  await page.locator("#worldInteract").click();await page.locator("#worldPanel").waitFor({state:"visible"});
}
async function close(page){if(await page.locator("#worldPanel").isVisible())await page.locator("#worldPanel").getByRole("button",{name:"ปิด",exact:true}).click();}
async function saved(page,match){
  await page.waitForFunction(text=>document.querySelector("#worldNotice")?.textContent.includes(text),match);
}
async function gather(page,name){
  await page.waitForFunction(text=>document.querySelector('#worldInteract')?.textContent.includes(text),name);
  await page.locator('#worldInteract').click();await saved(page,'+1');
  assert.equal(await page.locator('#worldPanel').isVisible(),false);
}
try{
  const a=await guest("World Owner"),b=await guest("World Friend");
  const ids=[(await me(a)).id,(await me(b)).id];assert.notEqual(ids[0],ids[1]);
  await a.screenshot({path:"/tmp/ro-world-town.png"});
  await a.evaluate(()=>window.qaScene.room.send("world:travel",{map:"market",x:1400}));
  await a.waitForFunction(()=>window.qaErrors.some(e=>e.code==="NOT_AT_EXIT"));assert.equal((await me(a)).map,"town");
  await map(a,"ป่าน้ำตก");assert.equal((await me(a)).id,ids[0]);
  await go(a,360,560);await gather(a,"เก็บเห็ด");
  assert.equal(await a.evaluate(()=>window.qaWorld.progress.inventory.mushroom),1);await close(a);
  await a.screenshot({path:"/tmp/ro-world-forest.png"});
  await a.emulateMedia({reducedMotion:"reduce"});await a.waitForTimeout(100);
  const frozen=await a.evaluate(()=>({water:window.qaScene.worldRenderer.water.commandBuffer.slice(),bugs:window.qaScene.worldRenderer.movingSprites.map(m=>[m.sprite.x,m.sprite.y])}));
  assert.ok(frozen.water.length>0);await a.waitForTimeout(300);
  assert.deepEqual(await a.evaluate(()=>({water:window.qaScene.worldRenderer.water.commandBuffer.slice(),bugs:window.qaScene.worldRenderer.movingSprites.map(m=>[m.sprite.x,m.sprite.y])})),frozen);
  await a.emulateMedia({reducedMotion:"no-preference"});
  await go(a,420,350);await gather(a,"ผีเสื้อ");
  await go(a,900,390);await activity(a,"แคมป์");await a.getByRole("button",{name:"นั่งข้างกองไฟ",exact:true}).click();
  await a.waitForFunction(()=>window.qaScene.room.state.players.get(window.qaScene.room.sessionId).activity==="camp");
  await map(a,"เมืองกลาง");
  await Promise.all([map(a,"ฟาร์มเพื่อนรัก"),map(b,"ฟาร์มเพื่อนรัก")]);
  await Promise.all([go(a,410,379),go(b,410,379)]);await a.locator('#directFarm:not([hidden])').waitFor();
  await a.getByRole("button",{name:"ปลูกแครอท",exact:true}).first().click();await saved(a,"ปลูก");
  const readyAt=await a.evaluate(()=>window.qaWorld.progress.plots[0].readyAt);assert.ok(readyAt>Date.now());
  await a.getByRole("button",{name:"เพื่อนช่วยรดน้ำ: ปิด",exact:true}).click();await saved(a,"เปิดให้");
  await b.getByRole("combobox",{name:"แปลงของใคร",exact:true}).selectOption(ids[0]);
  await b.getByRole("button",{name:"รดน้ำ −1 · E",exact:true}).click();await saved(b,"รดน้ำแล้ว");
  await a.waitForFunction(()=>window.qaWorld.progress.plots[0].watered===true);
  await a.screenshot({path:"/tmp/ro-world-farm-ui.png"});await close(a);await close(b);
  await go(a,984,312);await a.waitForFunction(()=>document.querySelector('#directFarm')?.dataset.slot==='4');
  await a.getByRole("button",{name:"ปลูกข้าวสาลี",exact:true}).first().click();await saved(a,"ปลูกข้าวสาลี");await close(a);
  await go(a,1030,580);await gather(a,"ให้อาหาร");
  await a.screenshot({path:"/tmp/ro-world-farm.png"});
  await map(a,"เมืองกลาง");await map(a,"หาดสายลม");
  await go(a,700,540);await gather(a,"หอยมุก");
  await go(a,420,340);await gather(a,"สมบัติ");
  await go(a,800,320);await gather(a,"เก็บขยะ");
  await go(a,600,602);await a.waitForFunction(()=>document.querySelector("#fishingPanel")?.dataset.near==="true");
  assert.match(await a.locator("#fishingPanel strong").innerText(),/ทะเล/);
  await go(a,1080,570);await activity(a,"ล่องเรือ");await a.getByRole("button",{name:"ขึ้นเรือ",exact:true}).click();
  await a.waitForFunction(()=>window.qaScene.room.state.players.get(window.qaScene.room.sessionId).activity==="boat");
  await a.waitForTimeout(6000);await a.screenshot({path:"/tmp/ro-world-beach-boat.png"});
  await a.waitForFunction(()=>window.qaWorld.progress.discovered.includes("voyager"),null,{timeout:26000});
  await a.waitForFunction(()=>window.qaScene.room.state.players.get(window.qaScene.room.sessionId).activity!=="boat");
  await map(a,"เมืองกลาง");await map(a,"ตลาดโคมไฟ");
  await map(b,"เมืองกลาง");await map(b,"ตลาดโคมไฟ");
  await Promise.all([go(a,430,540),go(b,430,540)]);await activity(a,"คาเฟ่");await activity(b,"คาเฟ่");
  await a.getByRole("button",{name:"เข้าทีม",exact:true}).click();await saved(a,"เข้าทีม");
  await b.getByRole("button",{name:"เข้าทีม",exact:true}).click();await saved(b,"เข้าทีม");
  await a.waitForFunction(()=>window.qaWorld.cafe.members.length===2);
  await a.getByRole("button",{name:"เริ่มครัว",exact:true}).click();await saved(a,"เริ่มครัว");
  assert.equal(await a.locator(".cafe-orders canvas").count(),4);
  assert.equal(await a.locator('.world-cafe-stations article[data-active="true"]').count(),1);
  assert.match(await a.locator(".world-cafe-order").innerText(),/สลัดสวน/);
  await a.screenshot({path:"/tmp/ro-world-cafe-running.png"});
  for(let i=0;i<12;i++){
    const page=i%2?a:b;await page.waitForFunction(station=>window.qaWorld.cafe.phase==="running"&&window.qaWorld.cafe.order===station,i%4);
    await page.getByRole("button",{name:new RegExp("^"+["รับออร์เดอร์","เตรียม","ปรุง","เสิร์ฟ"][i%4]+" ←")}).click();
    await saved(page,["รับออร์เดอร์แล้ว","เตรียมวัตถุดิบแล้ว","ปรุงแล้ว","เสิร์ฟแล้ว"][i%4]);await page.waitForTimeout(850);
  }
  await a.waitForFunction(()=>window.qaWorld.progress.inventory.chef===1);await b.waitForFunction(()=>window.qaWorld.progress.inventory.chef===1);
  await a.screenshot({path:"/tmp/ro-world-cafe.png"});await close(a);await close(b);
  await go(a,1020,500);await activity(a,"ร้านแลกชุด");
  const chefCard=a.locator(".world-collection article").filter({hasText:"หมวกเชฟ"});await chefCard.getByRole("button",{name:"ยืนยันแลก",exact:true}).click();await saved(a,"ปลดล็อก");
  await a.waitForFunction(()=>window.qaScene.room.state.players.get(window.qaScene.room.sessionId).cosmetic==="chef-hat");
  await close(a);await go(a,800,540);await go(a,800,300);await go(a,970,300);await activity(a,"ดนตรี");
  await a.getByRole("button",{name:"โด",exact:true}).click();await saved(a,"เล่นโน้ต");await close(a);
  await a.screenshot({path:"/tmp/ro-world-market.png"});
  for(const width of [1280,768,390,320]){
    await a.setViewportSize({width,height:844});await a.getByRole("button",{name:"สมุดสะสม",exact:true}).click();
    assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const box=await a.locator(".world-frame").boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
    await a.screenshot({path:"/tmp/ro-world-collection-"+width+".png"});await close(a);
  }
  await a.setViewportSize({width:1280,height:900});await map(a,"เมืองกลาง");await map(a,"ฟาร์มเพื่อนรัก");await go(a,490,460);await activity(a,"แปลงผัก");
  await a.waitForFunction(()=>Date.now()>=window.qaWorld.progress.plots[0].readyAt,null,{timeout:70000});
  await a.getByRole("button",{name:"เก็บเกี่ยว",exact:true}).first().waitFor();await a.waitForTimeout(300);
  await a.getByRole("button",{name:"เก็บเกี่ยว",exact:true}).first().click();await saved(a,"ผลผลิต");
  assert.equal(await a.evaluate(()=>window.qaWorld.progress.inventory.carrot),1);await close(a);
  const before=await a.evaluate(()=>({id:window.qaWorld.progress.equipped,inventory:window.qaWorld.progress.inventory}));
  await a.reload();await a.locator("#nameInput").fill("World Owner");await a.getByRole("button",{name:/เข้าเมือง/}).click();await a.waitForFunction(()=>window.qaScene?.room.state?.players?.get(window.qaScene.room.sessionId));
  await a.getByRole("button",{name:"กระเป๋า",exact:true}).click();
  assert.match(await a.locator("#worldPanel").innerText(),/แครอท/);
  assert.equal((await me(a)).id,ids[0]);assert.equal(await a.evaluate(()=>window.qaScene.room.state.players.get(window.qaScene.room.sessionId).cosmetic),before.id);
  assert.deepEqual(errors,[]);
  const noStorage=await browser.newContext();contexts.push(noStorage);
  await noStorage.addInitScript(()=>{Object.defineProperty(window,"localStorage",{get:()=>{throw new Error("Storage disabled");}});window.addEventListener("ro:dev-scene",event=>{window.qaScene=event.detail;});});
  const blocked=await noStorage.newPage();blocked.on("pageerror",error=>errors.push(error.message));
  await blocked.goto("http://127.0.0.1:5173");await blocked.locator("#nameInput").fill("Private Browser");await blocked.getByRole("button",{name:/เข้าเมือง/}).click();
  await blocked.waitForFunction(()=>window.qaScene?.room.state?.players?.get(window.qaScene.room.sessionId));
  await blocked.getByRole("button",{name:"กระเป๋า",exact:true}).click();await blocked.locator("#worldPanel").waitFor({state:"visible"});
  assert.deepEqual(errors,[]);
  console.log("PASS: real 5-map walking/identity, forest gathering/camp, farm ownership/help/offline growth/greenhouse/feed, beach finds/cleanup/boat/fishing trigger, visual 2-player cafe reward, cosmetic exchange/equip, approved music notes, collection 1280/768/390/320, reduced motion, disabled storage join, reload persistence; no page errors");
}finally{for(const context of contexts)await context.close();await browser.close();}
