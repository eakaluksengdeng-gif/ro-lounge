import test from 'node:test';import assert from 'node:assert/strict';
import {SnapshotStore} from '../src/storage/SnapshotStore';import {WorldManager,type WorldActor} from '../src/world/WorldManager';import {FishingManager} from '../src/nature/FishingManager';
import {WORLD_NODES,type Progress} from '../../shared/regions';import {cozyFresh,festivalWeek} from '../../shared/cozy';
let serial=0;
const fixture=()=>{let now=100000;const store=new SnapshotStore(),profiles:Record<string,Progress>={};for(const id of ['a','b','c','d','e'])profiles[id]={map:'town',inventory:{carrot:100,tomato:100,wheat:100,mushroom:100,shell:100,pearl:100},discovered:[],water:0,plots:[],allowHelp:false,unlocks:['none'],equipped:'none',cooldowns:{}};store.set('progress',profiles);store.set('fish',{a:{carp:3}});store.set('economy',{a:100,b:100});let fishing=new FishingManager(()=>now,undefined,undefined,store),world=new WorldManager(store,()=>now,fishing);
 for(const id of Object.keys(profiles))world.connect(id,id);
 const actor=(nodeId:string,id='a'):WorldActor=>{const n=WORLD_NODES.find(n=>n.id===nodeId)!;return{id,name:id,map:n.map,x:n.x,y:n.y};};
 const run=(verb:string,extra:Record<string,unknown>={},id='a')=>{const nodeId=verb==='cook'?'cafe':verb.startsWith('home-')?'cozy-home':'cozy-community';const raw={requestId:'cozy-test-'+(++serial),verb,nodeId,confirmed:true,...extra};return store.run(()=>world.action(actor(nodeId,id),raw,'sunny'));};
 return {store,get world(){return world;},get fishing(){return fishing;},actor,run,now:()=>now,advance(ms:number){now+=ms;},restore(){fishing=new FishingManager(()=>now,undefined,undefined,store);world=new WorldManager(store,()=>now,fishing);}};
};
test('cooking consumes real mixed stock, keeps discovery, rejects forged recipes and confirmation, persists food',async()=>{
 const f=fixture();await f.run('cook',{recipeId:'fish-soup',cost:{carp:0},xp:999999});assert.equal(f.fishing.holdings('a').carp,2);assert.equal(f.world.profile('a').inventory.carrot,99);assert.equal(f.world.profile('a').inventory['fish-soup'],1);assert.equal(f.world.profile('a').village!.xp.garden,12);assert.equal(f.world.profile('a').cozy!.festival.points,1);
 await assert.rejects(f.run('cook',{recipeId:'fish-soup'}),/ครัวพร้อม/);f.advance(3001);
 await assert.rejects(f.run('cook',{recipeId:'fake'}),/สูตร/);await assert.rejects(f.run('cook',{recipeId:'fish-soup',confirmed:false}),/ยืนยัน/);
 assert.throws(()=>f.world.action({...f.actor('cafe'),x:0},{requestId:'too-far-cozy',nodeId:'cafe',verb:'cook',recipeId:'fish-soup',confirmed:true},'sunny'),/เข้าใกล้/);
 f.restore();assert.equal(f.world.profile('a').inventory['fish-soup'],1);assert.ok(f.fishing.state('a','').discovered!.includes('carp'));assert.equal(f.world.profile('a').water,0);assert.deepEqual(f.store.get('economy',{}),{a:100,b:100});
});
test('cooking missing ingredient never spends fish or grants food',async()=>{
 const f=fixture(),profiles=f.store.get<Record<string,Progress>>('progress',{});profiles.a.inventory.carrot=0;f.store.set('progress',profiles);f.restore();await assert.rejects(f.run('cook',{recipeId:'fish-soup'}),/ไม่พอ/);assert.equal(f.fishing.holdings('a').carp,3);assert.equal(f.world.profile('a').inventory['fish-soup'],undefined);
});
test('home ownership, placement limits, rotations, private visits, remove preserves owned quantity and receipts',async()=>{
 const f=fixture();assert.equal(f.world.profile('a').cozy!.home.owned['forest-stool'],1);
 await f.run('home-place',{itemId:'forest-stool',x:2,y:3,rotation:1,ownerId:'b'});const placement=f.world.profile('a').cozy!.home.placements[0];assert.equal(f.world.profile('b').cozy!.home.placements.length,0);
 await assert.rejects(f.run('home-place',{itemId:'forest-stool',x:1,y:3,rotation:0}),/เหลือ/);
 await assert.rejects(f.run('home-place',{itemId:'picnic-rug',x:2,y:3,rotation:0}),/มีของ/);
 await assert.rejects(f.run('home-place',{itemId:'picnic-rug',x:Infinity,y:3,rotation:0}),/ตำแหน่ง/);
 await assert.rejects(f.run('home-place',{itemId:'picnic-rug',x:2,y:2,rotation:99}),/ทิศทาง/);
 await assert.rejects(f.run('home-remove',{uid:placement.uid},'b'),/ไม่พบ/);
 assert.equal(f.world.view('b','town').homes!.some(h=>h.id==='a'),false);await f.run('home-access',{open:true});assert.equal(f.world.view('b','town').homes!.some(h=>h.id==='a'),true);
 const raw={requestId:'same-home-remove',verb:'home-remove',nodeId:'cozy-home',uid:placement.uid,confirmed:true};await f.store.run(()=>f.world.action(f.actor('cozy-home'),raw,'sunny'));await f.store.run(()=>f.world.action(f.actor('cozy-home'),raw,'sunny'));assert.equal(f.world.profile('a').cozy!.home.owned['forest-stool'],1);
 await f.run('home-craft',{itemId:'aquarium'});assert.equal(f.fishing.holdings('a').carp,2);f.restore();assert.equal(f.world.profile('a').cozy!.home.owned.aquarium,1);assert.equal(f.world.profile('a').cozy!.home.open,true);
});
test('project limits are global, capped per player, serialized and durable; no currency reward',async()=>{
 const f=fixture();for(const id of ['a','b','c'])for(let i=0;i<10;i++)await f.run('project-contribute',{projectId:'flower-garden'},id);
 assert.equal(f.world.view('d','town').community!.projects['flower-garden'],30);await assert.rejects(f.run('project-contribute',{projectId:'flower-garden'},'d'),/สำเร็จ/);
 for(let i=0;i<10;i++)await f.run('project-contribute',{projectId:'shore-lights'});await assert.rejects(f.run('project-contribute',{projectId:'shore-lights'}),/ครบ 10/);
 const before=f.world.profile('d').inventory.shell;await assert.rejects(f.run('project-contribute',{projectId:'fake'},'d'),/โครงการ/);assert.equal(f.world.profile('d').inventory.shell,before);f.restore();assert.equal(f.world.view('a','town').community!.contributions['shore-lights'],10);assert.equal(f.world.view('a','town').community!.projects['flower-garden'],30);assert.deepEqual(f.store.get('economy',{}),{a:100,b:100});
});
test('picnic uses one meal, authoritative deadline/group size, private claims survive restart and newer groups',async()=>{
 const f=fixture();for(const id of ['a','b','c'])await f.run('cook',{recipeId:'picnic-bread'},id);
 await f.run('picnic-join',{foodId:'picnic-bread'});await f.run('picnic-join',{foodId:'picnic-bread'},'b');const picnic=f.world.view('a','town').community!.picnic!;
 assert.equal(f.world.profile('a').inventory['picnic-bread'],0);await assert.rejects(f.run('picnic-claim',{picnicId:picnic.id}),/ถึงเวลา/);await assert.rejects(f.run('picnic-join',{foodId:'picnic-bread'}),/รางวัลปิกนิกเดิม/);
 f.advance(30001);await assert.rejects(f.run('picnic-claim',{picnicId:picnic.id},'c'),/คุณรับ/);await f.run('picnic-claim',{picnicId:picnic.id});assert.equal(f.world.profile('a').village!.xp.explore,15);
 f.advance(60001);await f.run('picnic-join',{foodId:'picnic-bread'},'c');f.restore();assert.equal(f.world.view('b','town').community!.picnic!.id,picnic.id);await f.run('picnic-claim',{picnicId:picnic.id},'b');assert.equal(f.world.profile('b').village!.xp.explore,15);await assert.rejects(f.run('picnic-claim',{picnicId:picnic.id},'b'),/ถึงเวลา/);
 assert.equal(f.world.profile('a').cozy!.festival.points,3);await assert.rejects(f.run('picnic-join',{foodId:'picnic-bread'}),/วันละครั้ง/);
});
test('weekly festival grants one permanent lantern and bounded XP; reset only weekly stars',async()=>{
 const f=fixture();for(let i=0;i<10;i++)await f.run('project-contribute',{projectId:'flower-garden'});await f.run('festival-claim');assert.equal(f.world.profile('a').cozy!.home.owned['festival-lantern'],1);assert.equal(f.world.profile('a').village!.xp.explore,20);await assert.rejects(f.run('festival-claim'),/รับแล้ว/);
 const before=f.world.profile('a').inventory;f.advance(7*86400000);await assert.rejects(f.run('festival-claim'),/สะสมดาว/);for(let i=0;i<10;i++){await f.run('cook',{recipeId:'picnic-bread'});f.advance(3001);}await f.run('festival-claim');assert.equal(f.world.profile('a').cozy!.home.owned['festival-lantern'],1);assert.equal(f.world.profile('a').village!.xp.explore,40);assert.equal(f.world.profile('a').cozy!.festival.week,festivalWeek(f.now()));assert.equal(f.world.profile('a').inventory.carrot,before.carrot);assert.equal(cozyFresh().home.open,false);
});
test('simultaneous final project contributions settle only one ingredient and cannot overfill goal',async()=>{
 const f=fixture();f.store.set('townProjects',{'flower-garden':29});f.restore();const beforeD=f.world.profile('d').inventory.carrot,beforeE=f.world.profile('e').inventory.carrot;
 const results=await Promise.allSettled([f.run('project-contribute',{projectId:'flower-garden'},'d'),f.run('project-contribute',{projectId:'flower-garden'},'e')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.world.view('d','town').community!.projects['flower-garden'],30);assert.equal(f.world.profile('d').inventory.carrot+f.world.profile('e').inventory.carrot,beforeD+beforeE-1);
});
