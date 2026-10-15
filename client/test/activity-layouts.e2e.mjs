import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1200,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
  const poses=await page.evaluate(async()=>{
    const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();
    const {renderCharacterCanvas}=await import('/src/art.ts');const {appearanceToLook,DEFAULT_LOOK}=await import('/src/character/appearance.ts');
    const look=appearanceToLook(DEFAULT_LOOK),data={};
    for(const pose of ['standing','seated','fishing','prepare','cook','serve'])data[pose]=renderCharacterCanvas(look,'down',0,pose).toDataURL();
    return data;
  });
  assert.equal(new Set(Object.values(poses)).size,6,'activity bodies have real distinct pixels');
  const count=await page.request.get('http://127.0.0.1:5173/art/activity-v2/manifest.json').then(r=>r.json());
  assert.equal(count.poses.length,18);assert.equal(count.props.length,8);assert.equal(count.scenes.length,1);
  await page.evaluate(async()=>{
    const {WorldUI}=await import('/src/world/WorldUI.ts');
    document.body.replaceChildren();
    const players=new Map(Array.from({length:4},(_,i)=>['s'+i,{playerId:'p'+i,name:['ใบชา','ชมพู','มะลิ','ลุงแมว'][i],color:[0x78d9ec,0xf28b82,0xa7d676,0xfbbc04][i],hair:i,skin:0,pants:0,style:i%3,gender:i%2,cosmetic:i===2?'chef-hat':'none',mapId:'market',x:430,y:540}]));
    const callbacks=new Map(),sent=[];
    const room={sessionId:'s0',state:{players},send(type,body){sent.push({type,body});},onLeave(){},onMessage(type,fn){callbacks.set(type,fn);}};
    const scene={casinoOpen:false,worldOpen:false,stopNavigation(){},setWorldView(){}};
    const ui=new WorldUI(room,scene),view={map:'market',progress:{map:'market',inventory:{},discovered:[],plots:[],allowHelp:false,unlocks:['none'],equipped:'none',cooldowns:{}},farms:[],cleanup:0,boat:null,cafe:{phase:'lobby',members:[...players.values()].map(p=>({id:p.playerId,name:p.name,actions:0})),host:'p0',deadline:null,order:0,served:0,recipe:'salad',roundId:null}};
    ui.view=view;ui.previousMap='market';ui.node={id:'cafe',map:'market',x:430,y:540,kind:'cafe',name:'คาเฟ่ทำอาหาร 2–4 คน'};ui.open('cafe');
    window.cafeQa={ui,view,callbacks,sent};
  });
  assert.equal(await page.locator('.world-cafe-worker canvas').count(),4);
  assert.equal(await page.locator('.cafe-orders progress').count(),4);
  await page.getByRole('button',{name:'เริ่มครัว',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.cafeQa.sent.at(-1).body.verb),'cafe-start');
  await page.evaluate(()=>{const q=window.cafeQa;q.view.cafe={...q.view.cafe,phase:'running',roundId:'cafe-1',order:2,deadline:Date.now()+90000};q.callbacks.get('world:state')({...q.view,notice:'เริ่มครัว'});});
  assert.equal(await page.locator('.cafe-steam').isVisible(),true);
  assert.deepEqual(await page.locator('.cafe-orders progress').evaluateAll(list=>list.map(p=>p.value)),[1,1,0,0]);
  assert.equal(await page.getByRole('button',{name:'ปรุง ← ตอนนี้',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'ปรุง ← ตอนนี้',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>{const {verb,station,roundId}=window.cafeQa.sent.at(-1).body;return {verb,station,roundId};}),{verb:'cafe-work',station:2,roundId:'cafe-1'});
  await page.evaluate(()=>{const q=window.cafeQa;q.view.cafe={...q.view.cafe,order:3};q.callbacks.get('world:state')({...q.view,notice:'ปรุงแล้ว'});});
  assert.equal(await page.locator('.cafe-steam').isVisible(),false);
  for(const width of [1200,768,390,320]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const buttons=await page.locator('.world-cafe-stations button').evaluateAll(list=>list.map(b=>{const r=b.getBoundingClientRect();return [r.left,r.right];}));assert.ok(buttons.every(([l,r])=>l>=0&&r<=width));
    await page.screenshot({path:'/tmp/ro-activity-cafe-'+width+'.png',fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{const q=window.cafeQa;q.view.cafe.order=2;q.ui.render(true);});
  assert.equal(await page.locator('.cafe-steam span').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);console.log('PASS: 18 activity poses/8 props/cove, six distinct body poses, actual four-member cafe tableau, authoritative step/Ready events, progress/steam, 1200/768/390/320px/reduced motion');
}finally{await browser.close();}
