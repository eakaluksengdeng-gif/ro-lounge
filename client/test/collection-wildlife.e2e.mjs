import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:864}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>window.addEventListener('ro:dev-scene',e=>window.qaScene=e.detail));
 await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.locator('#nameInput').fill('Collection QA');await page.getByRole('button',{name:'เข้าเมือง',exact:true}).click();
 await page.waitForFunction(()=>window.qaScene?.room.state.players.get(window.qaScene.room.sessionId));
 await page.evaluate(()=>{window.qaView=null;window.qaErrors=[];window.qaScene.room.onMessage('api:error',e=>window.qaErrors.push(e));window.qaScene.room.onMessage('world:state',v=>window.qaView=v);window.qaScene.room.send('world:sync',{});});await page.waitForFunction(()=>window.qaView);
 assert.equal(await page.locator('#worldBagButton canvas').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.dataset.cozyArtVersion),'cozy-v3');
 assert.deepEqual(await page.evaluate(()=>{const t=window.qaScene.textures.get('fountain0').getSourceImage();return [t.width,t.height];}),[174,146]);
 await page.screenshot({path:'/tmp/ro-cozy-town.png'});
 for(const [id,item]of [['wild-6','butterfly'],['wild-9','bee'],['wild-11','ladybug']]){
  let near=false;
  for(let n=0;n<24;n++){
   near=await page.evaluate(id=>{const s=window.qaScene,p=s.room.state.players.get(s.room.sessionId),a=s.room.state.wildlife.get(id);if(Math.hypot(p.x-a.x,p.y-a.y)<78){s.stopNavigation();s.room.send('move',{x:p.x,y:p.y});return true;}s.navigateTo([{x:a.x,y:a.y}]);return false;},id);
   if(near)break;await page.waitForTimeout(700);
  }assert.ok(near,'walk close to '+id);
  await page.waitForTimeout(160);
  const point=await page.evaluate(id=>{const s=window.qaScene,a=s.room.state.wildlife.get(id),c=s.cameras.main;return {x:(a.x-c.scrollX)*c.zoom,y:(a.y-16-c.scrollY)*c.zoom};},id);
  const unobstructed=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)===window.qaScene.game.canvas,point);
  if(unobstructed)await page.mouse.click(point.x,point.y);
  else {await page.waitForFunction(item=>document.querySelector('#worldInteract')?.textContent.includes(item==='ladybug'?'เต่าทอง':item==='bee'?'ผึ้ง':'ผีเสื้อ'),item);await page.locator('#worldInteract').click();}
  try{await page.waitForFunction(item=>(window.qaView.progress.inventory[item]??0)===1,item,{timeout:12000});}catch(error){console.log('catch diagnostics',id,point,await page.evaluate(id=>{const s=window.qaScene,p=s.room.state.players.get(s.room.sessionId),a=s.room.state.wildlife.get(id);return {me:{x:p.x,y:p.y,map:p.mapId},animal:{x:a.x,y:a.y},errors:window.qaErrors,notice:document.querySelector('#worldToast')?.textContent,progress:window.qaView.progress};},id));await page.screenshot({path:'/tmp/ro-catch-failure.png'});throw error;}
  assert.equal(await page.locator('#worldPanel').isVisible(),false);assert.equal(await page.evaluate(id=>window.qaScene.nature.animals.get(id).body.visible,id),false);
 }
 await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();
 await page.getByRole('button',{name:'แมลง',exact:true}).click();await page.getByRole('button',{name:'ผึ้ง จำนวน 1',exact:true}).click();
 assert.match(await page.locator('.collection-inspector').innerText(),/ผึ้ง/);assert.match(await page.locator('.collection-inspector').innerText(),/ในกระเป๋า × 1/);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:864});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const r=await page.locator('.world-frame').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width);await page.screenshot({path:'/tmp/ro-collection-v3-'+width+'.png'});
 }
 await page.keyboard.press('KeyB');assert.equal(await page.locator('#worldPanel').isVisible(),false);await page.keyboard.press('KeyB');assert.equal(await page.locator('#worldPanel').isVisible(),true);
 await page.reload();await page.getByRole('button',{name:'เข้าเมือง',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#worldToolbar strong')?.textContent==='เมืองกลาง');
 await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();await page.getByRole('button',{name:'แมลง',exact:true}).click();assert.equal(await page.getByRole('button',{name:'เต่าทอง จำนวน 1',exact:true}).count(),1);
 assert.deepEqual(errors,[]);console.log('PASS live walk/native-click/nearby-tap butterfly+bee+ladybug (tap when chat obscures creature), hidden catches, bag/B/filter/details, 1440/768/390/320, alpha fountain and reload');
}finally{await browser.close();}
