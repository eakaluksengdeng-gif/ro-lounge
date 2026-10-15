import test from 'node:test';import assert from 'node:assert/strict';
import {SnapshotStore} from '../src/storage/SnapshotStore';import {WorldManager} from '../src/world/WorldManager';
import {EnvironmentManager} from '../src/nature/EnvironmentManager';import {SEEDS} from '../../shared/regions';import {SEASON_GEAR} from '../../shared/equipment';import {growthStage} from '../../shared/growth';
let seq=0;const message=(verb:string,extra:object={})=>({requestId:'season-test-'+(++seq),verb,...extra});
test('all seven crops grow in four visible stages, require water, harvest real stock and survive reconstruction',()=>{
 let now=10000;const store=new SnapshotStore(),world=new WorldManager(store,()=>now),actor={id:'a',name:'A',map:'farm' as const,x:410,y:379};world.connect('a','A');
 for(const seed of SEEDS){
  world.action(actor,message('plant',{nodeId:'farm-plots',slot:0,seed:seed.id}),'sunny');const crop=world.profile('a').plots[0]!;
  assert.equal(growthStage(crop,now),0);assert.equal(growthStage(crop,now+seed.growMs*.4),1);assert.equal(growthStage(crop,now+seed.growMs*.8),2);assert.equal(growthStage(crop,now+seed.growMs),2);
  assert.throws(()=>world.action(actor,message('harvest',{nodeId:'farm-plots',slot:0}),'sunny'));
  // Each unit is scooped at the real water point; initial two remain usable.
  if(world.profile('a').water===0){now+=801;world.action({...actor,x:800,y:520},message('refill',{nodeId:'farm-water'}),'sunny');}
  const request=message('water',{nodeId:'farm-plots',slot:0});world.action(actor,request,'sunny');const water=world.profile('a').water;world.action(actor,request,'sunny');assert.equal(world.profile('a').water,water);
  now+=seed.growMs;assert.equal(growthStage(world.profile('a').plots[0]!,now),3);world.action(actor,message('harvest',{nodeId:'farm-plots',slot:0}),'sunny');assert.equal(new WorldManager(store).profile('a').inventory[seed.id],1);
 }
 assert.equal(SEEDS.length,7);
});
test('tailor consumes server prices only, requires shop range and confirmation, unique ownership persists, never changes chips',()=>{
 const store=new SnapshotStore(),actor={id:'a',name:'A',map:'market' as const,x:1020,y:500};store.set('economy',{balance:113});
 const inventory:Record<string,number>={};for(const gear of SEASON_GEAR)for(const [id,n]of Object.entries(gear.cost))inventory[id]=(inventory[id]??0)+n;
 store.set('progress',{a:{map:'market',inventory,discovered:Object.keys(inventory),plots:Array(6).fill(null),allowHelp:false,unlocks:['none'],equipped:'none',cooldowns:{}}});
 const world=new WorldManager(store);world.connect('other','Other');
 for(const gear of SEASON_GEAR){const request=message('tailor-exchange',{nodeId:'shop',itemId:gear.id,confirmed:true,cost:{},ownerId:'other'});
  assert.throws(()=>world.action({...actor,x:0},request,'sunny'),/เข้าใกล้/);assert.throws(()=>world.action(actor,{...request,confirmed:false},'sunny'),/ยืนยัน/);
  world.action(actor,request,'sunny');world.action(actor,request,'sunny');assert.throws(()=>world.action(actor,message('tailor-exchange',{nodeId:'shop',itemId:gear.id,confirmed:true}),'sunny'),/มีชุดนี้แล้ว/);
  world.action(actor,message('equip-slot',{slot:'body',itemId:gear.id}),'sunny');assert.equal(new WorldManager(store).profile('a').equipment?.body,gear.id);
 }
 assert.ok(Object.values(world.profile('a').inventory).every(n=>n===0));assert.deepEqual(store.get('economy',{}),{balance:113});assert.equal(world.profile('other').unlocks.length,1);
 assert.throws(()=>world.action(actor,message('tailor-exchange',{nodeId:'shop',itemId:'fake',confirmed:true}),'sunny'),/ไม่มีชุด/);
});
test('cats choose bounded sit/groom/stretch/sleep pauses and resume moving without teleporting',()=>{
 for(const [roll,pose]of [[0,'sit'],[.3,'groom'],[.6,'stretch'],[.9,'sleep']] as const){const env=new EnvironmentManager(0,120000,()=>roll);env.update(1,16);const cat=env.animals.get('wild-0')!;assert.equal(cat.behavior,pose);assert.equal(cat.moving,false);const {x,y,pauseUntil}=cat;env.update(pauseUntil-1,16);assert.equal(cat.x,x);assert.equal(cat.y,y);env.update(pauseUntil+1,16);assert.ok(Math.hypot(cat.x-x,cat.y-y)<=.481);if(cat.moving)assert.equal(cat.behavior,'walk');}
});
