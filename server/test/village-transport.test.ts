import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import type {AddressInfo} from 'node:net';import {Server,type Client as ServerClient} from 'colyseus';import {WebSocketTransport} from '@colyseus/ws-transport';import {Client,type Room} from 'colyseus.js';import {TownRoom} from '../src/rooms/TownRoom';import {world} from '../src/services';import {WORLD_NODES,type WorldView} from '../../shared/regions';import type {ApiError,GuestReady} from '../../shared/pokdeng';
class VillageRoom extends TownRoom{
 onJoin(client:ServerClient,options:any){super.onJoin(client,options);const p=this.state.players.get(client.sessionId)!,board=WORLD_NODES.find(n=>n.id==='village-board')!;p.x=p.targetX=board.x;p.y=p.targetY=board.y;
  if(!options.sessionId)for(const id of ['mushroom-a','mushroom-b']){const n=WORLD_NODES.find(n=>n.id===id)!;world.action({id:p.playerId,name:p.name,map:n.map,x:n.x,y:n.y},{requestId:'test-seed-'+id,verb:'collect',nodeId:id},'sunny');}
 }
}
const next=<T>(r:Room,event:string,match:(v:T)=>boolean=()=>true)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Missing '+event)),8000);const off=r.onMessage<T>(event,v=>{if(!match(v))return;clearTimeout(timer);off();resolve(v);});});
test('real village socket confirms, rejects forged claims and preserves one reward across reconnect',async()=>{
 const http=createServer(),server=new Server({transport:new WebSocketTransport({server:http}),greet:false,gracefullyShutdown:false});server.define('village_test',VillageRoom);await server.listen(0,'127.0.0.1');const address=http.address() as AddressInfo;
 const sdk=new Client('ws://127.0.0.1:'+address.port),rooms:Room[]=[];const join=async(options:object)=>{const r=await sdk.joinOrCreate('village_test',options);r.onMessage('*',()=>{});rooms.push(r);return r;};
 try{const r=await join({name:'Village QA'});const authP=next<GuestReady>(r,'auth:ready');r.send('auth:sync',{});const auth=await authP;
  const msg={requestId:'wire-order-once',verb:'order-submit',nodeId:'village-board',orderId:'forest',confirmed:true,xp:99999,cost:{},ownerId:'other'};
  const bad=next<ApiError>(r,'api:error');r.send('world:action',{...msg,confirmed:false});assert.equal((await bad).code,'CONFIRM_REQUIRED');
  const saved=next<WorldView>(r,'world:state',v=>!!v.notice);r.send('world:action',msg);const v=await saved;assert.equal(v.progress.inventory.mushroom,0);assert.equal(v.progress.village!.xp.nature,24);assert.ok(v.progress.unlocks.includes('camp-hat'));assert.ok(v.progress.discovered.includes('mushroom'));
  const replay=next<WorldView>(r,'world:state',v=>!!v.notice);r.send('world:action',msg);assert.equal((await replay).progress.village!.xp.nature,24);await r.leave();
  const resumed=await join({name:'Village QA',sessionId:auth.sessionId});const sync=next<WorldView>(resumed,'world:state');resumed.send('world:sync',{});assert.equal((await sync).progress.village!.xp.nature,24);
  const denied=next<ApiError>(resumed,'api:error');resumed.send('world:action',{...msg,requestId:'wire-order-repeat'});assert.equal((await denied).code,'COOLDOWN');
 }finally{for(const r of rooms)if(r.connection.isOpen)await r.leave();await server.gracefullyShutdown(false);}
});
