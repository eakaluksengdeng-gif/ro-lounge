import test from 'node:test';import assert from 'node:assert/strict';
import {SnapshotStore} from '../src/storage/SnapshotStore';import {WorldManager,type WorldActor} from '../src/world/WorldManager';import {FishingManager} from '../src/nature/FishingManager';
import {WORLD_NODES,type Progress} from '../../shared/regions';import {ORDER_COOLDOWN} from '../../shared/village';
let seq=0;const request=(verb:string,extra:object={})=>({requestId:'village-qa-'+(++seq),verb,nodeId:verb==='order-submit'?'village-board':'nature-museum',confirmed:true,...extra});
const actor=(nodeId='village-board'):WorldActor=>{const n=WORLD_NODES.find(n=>n.id===nodeId)!;return{id:'a',name:'A',map:n.map,x:n.x,y:n.y};};
const fixture=()=>{let now=100000;const store=new SnapshotStore();const p:Progress={map:'town',inventory:{carrot:4,mushroom:4,bee:2,beetle:2,butterfly:1,ladybug:1,firefly:1},discovered:['carrot','mushroom','bee','beetle','butterfly','ladybug','firefly'],plots:[],allowHelp:false,unlocks:['none'],equipped:'none',cooldowns:{}};store.set('progress',{a:p});store.set('fish',{a:{carp:2}});store.set('economy',{unchanged:123});const fishing=new FishingManager(()=>now,undefined,undefined,store),world=new WorldManager(store,()=>now,fishing);return {store,fishing,world,advance(){now+=ORDER_COOLDOWN+1;}};};
test('orders confirm/proximity/stock, debit once, save skills/outfit/cooldown and preserve fish discovery',async()=>{
 const f=fixture(),req=request('order-submit',{orderId:'fish'});
 assert.throws(()=>f.world.action(actor(),{...req,confirmed:false},'sunny'),/ยืนยัน/);
 assert.throws(()=>f.world.action({...actor(),x:0},req,'sunny'),/เข้าใกล้/);
 await f.store.run(()=>f.world.action(actor(),req,'sunny'));
 assert.equal(f.world.profile('a').inventory.carrot,3);assert.equal(f.fishing.holdings('a').carp,1);assert.equal(f.world.profile('a').village!.xp.fishing,25);assert.ok(f.world.profile('a').unlocks.includes('fisher-hat'));
 await f.store.run(()=>f.world.action(actor(),req,'sunny'));assert.equal(f.fishing.holdings('a').carp,1);
 const restored=new WorldManager(f.store,undefined,new FishingManager(undefined,undefined,undefined,f.store));assert.equal(restored.profile('a').village!.xp.fishing,25);assert.equal(restored.profile('a').inventory.carrot,3);
 assert.throws(()=>f.world.action(actor(),request('order-submit',{orderId:'fish'}),'sunny'),/รอบถัดไป/);
 f.advance();await f.store.run(()=>f.world.action(actor(),request('order-submit',{orderId:'fish'}),'sunny'));assert.equal(f.fishing.holdings('a').carp,0);assert.equal(f.world.profile('a').unlocks.filter(x=>x==='fisher-hat').length,1);
 const fishAgain=new FishingManager(undefined,undefined,undefined,f.store);assert.ok(fishAgain.state('a','').discovered!.includes('carp'));assert.ok(f.world.profile('a').discovered.includes('carp'));assert.deepEqual(f.store.get('economy',{}),{unchanged:123});
 f.advance();const before=f.world.profile('a');assert.throws(()=>f.world.action(actor(),request('order-submit',{orderId:'fish',cost:{carrot:0},xp:99999}),'sunny'),/ไม่พอ/);assert.deepEqual(f.world.profile('a'),before);
});
test('museum uses one specimen per species, confirmed donation, five-species reward, no replay mint',async()=>{
 const f=fixture();for(const id of ['bee','beetle','butterfly','ladybug','carp']){const r=request('museum-donate',{itemId:id});await f.store.run(()=>f.world.action(actor('nature-museum'),r,'sunny'));await f.store.run(()=>f.world.action(actor('nature-museum'),r,'sunny'));}
 const p=f.world.profile('a');assert.equal(p.village!.museum.length,5);assert.ok(p.unlocks.includes('cat-hat'));assert.equal(p.inventory.butterfly,0);assert.ok(p.discovered.includes('butterfly'));assert.equal(f.fishing.holdings('a').carp,1);
 assert.throws(()=>f.world.action(actor('nature-museum'),request('museum-donate',{itemId:'bee'}),'sunny'),/ส่งซ้ำ/);
 assert.throws(()=>f.world.action(actor('nature-museum'),request('museum-donate',{itemId:'chef'}),'sunny'),/เฉพาะปลา/);
 assert.equal(new WorldManager(f.store).profile('a').village!.museum.length,5);
});
test('missing mixed ingredient does not consume available fish; legacy defaults retain water and stock',()=>{
 const f=fixture();f.world.action(actor(),request('order-submit',{orderId:'carrots'}),'sunny');f.advance();f.world.action(actor(),request('order-submit',{orderId:'carrots'}),'sunny');
 const before=f.fishing.holdings('a');assert.throws(()=>f.world.action(actor(),request('order-submit',{orderId:'fish'}),'sunny'),/ไม่พอ/);assert.deepEqual(f.fishing.holdings('a'),before);assert.equal(f.world.profile('a').water,2);
});
