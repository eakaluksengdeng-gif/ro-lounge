import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SnapshotStore } from "../src/storage/SnapshotStore";
import { EconomyManager } from "../src/economy/EconomyManager";
import { GuestManager } from "../src/auth/GuestManager";
import { WorldManager, type WorldActor } from "../src/world/WorldManager";
import { FishingManager } from "../src/nature/FishingManager";
import { WORLD_NODES, destination, exitDirection, arrival, worldBlocked, beachFishingLocation, boatPosition } from "../../shared/regions";
import { EnvironmentManager } from '../src/nature/EnvironmentManager';
import { CATCHABLE_BUGS,wildlifeCatchKey } from '../../shared/nature';
let sequence=0;
const request=(verb:string,nodeId:string,extra:Record<string,unknown>={})=>({requestId:"action-qa-"+(++sequence),verb,nodeId,...extra});
const actor=(id:string,nodeId:string):WorldActor=> {const n=WORLD_NODES.find(n=>n.id===nodeId)!;return{id,name:id,map:n.map,x:n.x,y:n.y};};
test('every roaming insect is catchable using trusted live positions, never client rewards or animals',()=>{
 const store=new SnapshotStore(),world=new WorldManager(store,()=>10000),env=new EnvironmentManager(10000);world.connect('catcher','C');
 let count=0;
 for(const [id,animal]of env.animals){if(!CATCHABLE_BUGS[animal.kind])continue;
   const who:WorldActor={id:'catcher',name:'C',map:'town',x:animal.x,y:animal.y};const msg=request('catch','forged-node',{wildlifeId:id,item:'treasure',amount:99999,x:0,y:0});
   world.action(who,msg,'sunny',env.animals);world.action(who,msg,'sunny',env.animals);count++;
   assert.throws(()=>world.action(who,request('catch','',{wildlifeId:id}),'sunny',env.animals),/ฟื้นตัว/);
   assert.ok(world.profile('catcher').cooldowns[wildlifeCatchKey('town',id)]);
 }
 assert.equal(count,7);assert.equal(world.profile('catcher').inventory.butterfly,3);assert.equal(world.profile('catcher').inventory.bee,2);assert.equal(world.profile('catcher').inventory.ladybug,2);assert.equal(world.profile('catcher').inventory.treasure,undefined);
 const who:WorldActor={id:'catcher',name:'C',map:'town',x:0,y:0};
 assert.throws(()=>world.action(who,request('catch','',{wildlifeId:'wild-6',x:430,y:460}),'sunny',env.animals),/เข้าใกล้/);
 for(const id of ['wild-0','wild-3','missing','__proto__'])assert.throws(()=>world.action(who,request('catch','',{wildlifeId:id}),'sunny',env.animals),/จับไม่ได้/);
 assert.throws(()=>world.action({...who,x:430,y:460},request('catch','',{wildlifeId:'wild-6',kind:'butterfly'}),'sunny'),/จับไม่ได้/);
 const restored=new WorldManager(store,()=>10000);assert.equal(restored.profile('catcher').inventory.bee,2);
 assert.throws(()=>restored.action({...who,x:430,y:460},request('catch','',{wildlifeId:'wild-6'}),'sunny',env.animals),/ฟื้นตัว/);
});
test('personal water is spent once, refill requires proximity, and zero survives reload',()=>{
  let now=10000;const store=new SnapshotStore(),world=new WorldManager(store,()=>now);world.connect('water-user','W');
  assert.equal(world.profile('water-user').water,2);
  for(let slot=0;slot<3;slot++)world.action(actor('water-user','farm-plots'),request('plant','farm-plots',{slot,seed:'carrot'}),'sunny');
  const action=request('water','farm-plots',{slot:0});
  world.action(actor('water-user','farm-plots'),action,'sunny');world.action(actor('water-user','farm-plots'),action,'sunny');
  assert.equal(world.profile('water-user').water,1);
  world.action(actor('water-user','farm-plots'),request('water','farm-plots',{slot:1}),'sunny');
  assert.throws(()=>world.action(actor('water-user','farm-plots'),request('water','farm-plots',{slot:2}),'sunny'),/น้ำหมด/);
  assert.equal(new WorldManager(store).profile('water-user').water,0);
  assert.throws(()=>world.action({...actor('water-user','farm-water'),x:0},request('refill','farm-water'),'sunny'),/เข้าใกล้/);
  const refill=request('refill','farm-water');world.action(actor('water-user','farm-water'),refill,'sunny');world.action(actor('water-user','farm-water'),refill,'sunny');
  assert.equal(world.profile('water-user').water,1);
  assert.throws(()=>world.action(actor('water-user','farm-water'),request('refill','farm-water'),'sunny'),/รอตัก/);
  now+=1000;world.action(actor('water-user','farm-water'),request('refill','farm-water'),'sunny');assert.equal(world.profile('water-user').water,2);
});
test('legacy profiles receive two water without replacing inventory or wallet',()=>{
 const store=new SnapshotStore();store.set('progress',{legacy:{map:'farm',inventory:{carrot:8},discovered:['carrot'],plots:Array(6).fill(null),allowHelp:false,unlocks:['none'],equipped:'none',cooldowns:{}}});
 const economy=new EconomyManager(store);const guest=new GuestManager(economy,store).connect(undefined,'qa');
 const balance=economy.view(guest.playerId).balance;
 const world=new WorldManager(store);assert.equal(world.profile('legacy').water,2);assert.equal(world.profile('legacy').inventory.carrot,8);
 world.action(actor('legacy','farm-water'),request('refill','farm-water'),'sunny');
 assert.equal(new WorldManager(store).profile('legacy').water,3);assert.equal(economy.view(guest.playerId).balance,balance);
});
test("Guest, settled balances, one-time catch ledgers and world inventory survive a full process reconstruction",()=>{
  const dir=mkdtempSync(join(tmpdir(),"ro-world-save-")),file=join(dir,"snapshot.json");
  let store=new SnapshotStore(file),economy=new EconomyManager(store),guests=new GuestManager(economy,store),world=new WorldManager(store);
  const a=guests.connect(undefined,"same-wifi"),b=guests.connect(undefined,"same-wifi");
  world.connect(a.playerId,"A");world.connect(b.playerId,"B");
  economy.reserveBatch([{playerId:a.playerId,key:"round",amount:50},{playerId:b.playerId,key:"round",amount:50}]);
  economy.settle("round-one",[{playerId:a.playerId,key:"round",delta:10},{playerId:b.playerId,key:"round",delta:-10}]);
  economy.rewardFishingCatch(a.playerId,"catch-one",7);
  world.action(actor(a.playerId,"mushroom-a"),request("collect","mushroom-a"),"sunny");
  world.travel(a.playerId,"forest");
  store=new SnapshotStore(file);economy=new EconomyManager(store);guests=new GuestManager(economy,store);world=new WorldManager(store);
  assert.equal(guests.resume(a.sessionId,"changed-ip").playerId,a.playerId);
  assert.equal(economy.view(a.playerId).balance,117);assert.equal(economy.view(b.playerId).balance,90);
  assert.equal(economy.rewardFishingCatch(a.playerId,"catch-one",7),false);
  assert.equal(world.profile(a.playerId).inventory.mushroom,1);assert.equal(world.profile(a.playerId).map,"forest");
  assert.equal(world.profile(a.playerId).discovered.includes("mushroom"),true);
  const receipt=Object.keys(world.profile(a.playerId).receipts!)[0];
  world.action(actor(a.playerId,"mushroom-a"),{requestId:receipt,verb:"collect",nodeId:"mushroom-a"},"sunny");
  assert.equal(world.profile(a.playerId).inventory.mushroom,1,"old completed request cannot mint again after reconstruction");
  assert.ok(!Object.keys(world.view(a.playerId,"forest")).includes("sessionId"));
  assert.equal(JSON.parse(readFileSync(file,"utf8")).version,1);
});
test("restart cancels uncommitted hand reservations, never refunds an already settled loss",()=>{
  const file=join(mkdtempSync(join(tmpdir(),"ro-world-hold-")),"save.json"),store=new SnapshotStore(file),economy=new EconomyManager(store);
  economy.create("a");economy.create("b");
  economy.reserveBatch([{playerId:"a",key:"old",amount:50},{playerId:"b",key:"old",amount:50}]);
  economy.settle("settled",[{playerId:"a",key:"old",delta:-30},{playerId:"b",key:"old",delta:30}]);
  economy.reserveBatch([{playerId:"a",key:"active",amount:50}]);
  const restored=new EconomyManager(new SnapshotStore(file));
  assert.deepEqual(restored.view("a"),{balance:70,reserved:0,available:70});assert.equal(restored.view("b").balance,130);
});
test("world actions verify map, proximity, casino state and server cooldown; replay cannot grant twice",()=>{
  let now=1000000;const world=new WorldManager(undefined,()=>now);world.connect("a","A");
  const a=actor("a","mushroom-a"),msg=request("collect","mushroom-a");
  assert.throws(()=>world.action({...a,map:"town"},msg,"sunny"),/แมพอื่น/);
  assert.throws(()=>world.action({...a,x:0,y:0},msg,"sunny"),/เข้าใกล้/);
  assert.throws(()=>world.action({...a,inCasino:true},msg,"sunny"),/ออกจากโต๊ะ/);
  world.action(a,msg,"sunny");world.action(a,msg,"sunny");
  assert.equal(world.profile("a").inventory.mushroom,1);
  assert.throws(()=>world.action(a,request("collect","mushroom-a",{amount:99999}),"sunny"),/ฟื้นตัว/);
  now+=45000;world.action(a,request("collect","mushroom-a"),"sunny");assert.equal(world.profile("a").inventory.mushroom,2);
});
test("farm is offline-growing, permissioned, owner-only harvested and replay-safe",()=>{
  let now=1000;const store=new SnapshotStore(),world=new WorldManager(store,()=>now);world.connect("owner","Owner");world.connect("helper","Helper");
  const owner=actor("owner","farm-plots"),helper=actor("helper","farm-plots");
  world.action(owner,request("plant","farm-plots",{slot:0,seed:"carrot"}),"sunny");
  assert.throws(()=>world.action(helper,request("water","farm-plots",{slot:0,ownerId:"owner"}),"sunny"),/ไม่อนุญาต/);
  world.action(owner,request("allow-help","farm-plots",{allow:true}),"sunny");
  world.action(helper,request("water","farm-plots",{slot:0,ownerId:"owner"}),"sunny");
  now+=60000;
  assert.throws(()=>world.action(helper,request("harvest","farm-plots",{slot:0,ownerId:"owner"}),"sunny"),/เฉพาะเจ้าของ/);
  const reloaded=new WorldManager(store,()=>now);assert.equal(reloaded.profile("owner").plots[0]?.watered,true);
  const msg=request("harvest","farm-plots",{slot:0});reloaded.action(owner,msg,"sunny");reloaded.action(owner,msg,"sunny");
  assert.equal(reloaded.profile("owner").inventory.carrot,1);assert.equal(reloaded.profile("helper").inventory.carrot,undefined);
  assert.throws(()=>reloaded.action(owner,request("plant","farm-plots",{slot:4,seed:"carrot"}),"sunny"),/โรงเรือน/);
  reloaded.action(actor("owner","greenhouse"),request("plant","greenhouse",{slot:4,seed:"wheat"}),"sunny");
});
test("forest rare encounter and firefly conditions come from server time/weather",()=>{
  let now=1000;const world=new WorldManager(undefined,()=>now);world.connect("a","A");
  assert.throws(()=>world.action(actor("a","forest-rare"),request("collect","forest-rare"),"rain"),/หิมะ/);
  world.action(actor("a","forest-rare"),request("collect","forest-rare"),"snow");
  assert.throws(()=>world.action(actor("a","bug-firefly"),request("collect","bug-firefly"),"sunny"),/กลางคืน/);
  now=600000;world.action(actor("a","bug-firefly"),request("collect","bug-firefly"),"sunny");
  assert.deepEqual(world.profile("a").discovered.sort(),["firefly","snow-rabbit"].sort());
});
test("cosmetic exchange has exact inventory costs, equip requires owned unlock and discovery survives spending",()=>{
  let now=0;const world=new WorldManager(undefined,()=>now);world.connect("a","A");
  const shop=actor("a","shop");
  assert.throws(()=>world.action(shop,request("exchange","shop",{cosmeticId:"camp-hat",price:0}),"sunny"),/ไม่พอ/);
  assert.throws(()=>world.action(shop,request("equip","shop",{cosmeticId:"chef-hat"}),"sunny"),/ปลดล็อก/);
  for(let i=0;i<3;i++){now+=45001;world.action(actor("a","mushroom-a"),request("collect","mushroom-a"),"sunny");}
  for(let i=0;i<2;i++){now+=45001;world.action(actor("a","bug-blue"),request("collect","bug-blue"),"sunny");}
  world.action(shop,request("exchange","shop",{cosmeticId:"camp-hat"}),"sunny");
  assert.equal(world.profile("a").inventory.mushroom,0);assert.equal(world.profile("a").equipped,"camp-hat");
  assert.ok(world.profile("a").discovered.includes("mushroom"));
});
test("cooperative cafe requires 2–4 members, host start, ordered timed stations and contribution; only completed rounds reward once",()=>{
  let now=0;const world=new WorldManager(undefined,()=>now);
  for(const id of ["a","b","c","d","e"])world.connect(id,id);
  const a=actor("a","cafe"),b=actor("b","cafe");
  world.action(a,request("cafe-join","cafe"),"sunny");
  assert.throws(()=>world.action(a,request("cafe-start","cafe"),"sunny"),/2–4/);
  world.action(b,request("cafe-join","cafe"),"sunny");
  assert.throws(()=>world.action(b,request("cafe-start","cafe"),"sunny"),/2–4/);
  world.action(a,request("cafe-start","cafe"),"sunny");
  const roundId=world.view("a","market").cafe.roundId;
  assert.throws(()=>world.action(a,request("cafe-work","cafe",{station:1,roundId}),"sunny"),/ลำดับ/);
  assert.throws(()=>world.action(a,request("cafe-work","cafe",{station:0,roundId:"forged"}),"sunny"),/รอบเก่า/);
  for(let i=0;i<12;i++){now+=1000;world.action(i%2?a:b,request("cafe-work","cafe",{station:i%4,roundId}),"sunny");}
  assert.equal(world.view("a","market").cafe.phase,"result");
  assert.equal(world.profile("a").inventory.chef,1);assert.equal(world.profile("b").inventory.chef,1);
  assert.throws(()=>world.action(a,request("cafe-work","cafe",{station:0,roundId}),"sunny"),/จบรอบ/);
  world.action(a,request("cafe-reset","cafe"),"sunny");
  world.action(actor("c","cafe"),request("cafe-join","cafe"),"sunny");world.action(actor("d","cafe"),request("cafe-join","cafe"),"sunny");
  assert.throws(()=>world.action(actor("e","cafe"),request("cafe-join","cafe"),"sunny"),/ห้องเต็ม/);
});
test("boat capacity/departure/return is server-owned and camp/music/feeding never mint chips",()=>{
  let now=1000;const world=new WorldManager(undefined,()=>now);for(const id of ["a","b","c","d","e"])world.connect(id,id);
  for(const id of ["a","b","c","d"])world.action(actor(id,"boat"),request("boat","boat"),"sunny");
  assert.throws(()=>world.action(actor("e","boat"),request("boat","boat"),"sunny"),/เต็ม/);
  const boat=world.boatFor("a")!;assert.equal(boat.members.length,4);assert.ok(boatPosition(boat.departAt,boat.departAt+10000).y>650);
  now+=24000;assert.equal(world.tick().length,4);assert.equal(world.boatFor("a"),null);
  assert.equal(world.profile("a").inventory.voyager,1);assert.equal(world.tick().length,0);
  world.action(actor("a","camp"),request("sit","camp"),"sunny");
  world.action(actor("a","animal-garden"),request("feed","animal-garden"),"sunny");
  world.action(actor("a","stage"),request("note","stage",{note:3}),"sunny");
  assert.ok(world.profile("a").discovered.includes("camper"));assert.ok(world.profile("a").discovered.includes("musician"));
  assert.throws(()=>world.action(actor("a","stage"),request("note","stage",{note:99}),"sunny"),/โน้ต/);
});
test("five-map topology, edge gates, safe arrivals and beach shore/pier match shared collision",()=>{
  for(const [direction,map]of [["north","forest"],["south","beach"],["west","farm"],["east","market"]] as const) {
    assert.equal(destination("town",direction),map);const p=arrival(map,"town");assert.equal(exitDirection(p.x,p.y),null);assert.equal(worldBlocked(map,p.x,p.y),false);
  }
  assert.equal(exitDirection(720,90),"north");assert.equal(exitDirection(25,432),"west");assert.equal(exitDirection(720,400),null);
  assert.ok(beachFishingLocation(600,602));assert.ok(beachFishingLocation(1080,760));assert.equal(beachFishingLocation(600,800),null);
  assert.equal(worldBlocked("beach",600,800),true);assert.equal(worldBlocked("beach",1080,760),false);
});
test("fishing inventory survives reconstruction and sea catches are distinct without changing chip rules",()=>{
  let now=0;const store=new SnapshotStore();const rewards:number[]=[];
  let fish=new FishingManager(()=>now,()=>0,(_id,_cast,chips)=>{rewards.push(chips);return true;},store);
  fish.cast("a","owner",600,602,false,"beach");now=4000;fish.tick("a","owner");now=4600;
  fish.reel("a","owner",fish.state("a","owner").castId);
  assert.equal(fish.state("a","owner").result?.fish?.species,"mackerel");assert.equal(rewards[0],1);
  fish=new FishingManager(()=>now,()=>0,()=>true,new SnapshotStore());
  const loaded=new FishingManager(()=>now,()=>0,()=>true,store);
  assert.equal(loaded.state("a","new-owner").inventory.mackerel,1);assert.equal(loaded.state("a","new-owner").phase,"idle");
});
test("remote save barrier serializes complete operations and withholds notifications until confirmed",async()=>{
  const original=globalThis.fetch;let saved:any={version:1,data:{}},revision=0,requests=0,release:(()=>void)|undefined;
  globalThis.fetch=(async(url:any,options:any)=> {
    if(options.method==="GET")return new Response(JSON.stringify([{revision,snapshot:saved}]),{status:200});
    requests++;await new Promise<void>(resolve=>{release=resolve;});
    const body=JSON.parse(options.body);assert.equal(body.expected_revision,revision);saved=body.new_snapshot;return new Response(JSON.stringify(++revision),{status:200});
  }) as typeof fetch;
  try {
    const store=new SnapshotStore();await store.connectSupabase("https://test.supabase.co","server-secret");
    const economy=new EconomyManager(store);let acknowledged=false;
    const op=store.run(()=>{economy.create("a");store.set("progress",{a:{collected:true}});store.deliver(()=>{acknowledged=true;});});
    await new Promise(resolve=>setTimeout(resolve,10));assert.equal(acknowledged,false);assert.equal(requests,1);
    release!();await op;await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(acknowledged,true);assert.equal(saved.data.wallets.balances.a,100);assert.equal(saved.data.progress.a.collected,true);
  }finally{globalThis.fetch=original;}
});
test("an acknowledged-in-DB save with a lost HTTP response retries its operation id, never overwrites or rewards twice",async()=>{
  const original=globalThis.fetch;let revision=0,saved:any={version:1,data:{}},lastWrite="",drop=true;
  globalThis.fetch=(async(_url:any,options:any)=>{
    assert.equal(options.headers.Authorization,undefined,"modern secret keys are never sent as JWT Bearer");
    if(options.method==="GET")return new Response(JSON.stringify([{revision,snapshot:saved}]),{status:200});
    const body=JSON.parse(options.body);
    if(body.operation_id!==lastWrite){assert.equal(body.expected_revision,revision);saved=body.new_snapshot;lastWrite=body.operation_id;revision++;}
    if(drop){drop=false;throw new Error("response lost after commit");}
    return new Response(JSON.stringify(revision),{status:200});
  }) as typeof fetch;
  try{
    const store=new SnapshotStore();await store.connectSupabase("https://test.supabase.co","sb_secret_test");const economy=new EconomyManager(store);
    await assert.rejects(store.run(()=>economy.create("a")),/response lost/);
    assert.equal(revision,1);await store.flush();assert.equal(revision,1);assert.equal(saved.data.wallets.balances.a,100);
    await store.run(()=>economy.rewardFishingCatch("a","one-catch",10));assert.equal(revision,2);assert.equal(saved.data.wallets.balances.a,110);
    assert.equal(economy.rewardFishingCatch("a","one-catch",10),false);
  }finally{globalThis.fetch=original;}
});
