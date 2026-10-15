import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import type {AddressInfo} from 'node:net';import {Server,type Client as ServerClient} from 'colyseus';import {WebSocketTransport} from '@colyseus/ws-transport';import {Client,type Room} from 'colyseus.js';import {TownRoom} from '../src/rooms/TownRoom';import {world} from '../src/services';import {WORLD_NODES,type WorldView,type Progress} from '../../shared/regions';import type {ApiError,GuestReady} from '../../shared/pokdeng';
/** Fixture-only placement/stock. This room is never registered by production index.ts. */
class CozyRoom extends TownRoom{
 onJoin(client:ServerClient,options:any){super.onJoin(client,options);const p=this.state.players.get(client.sessionId)!,n=WORLD_NODES.find(n=>n.id==='cozy-home')!;p.x=p.targetX=n.x;p.y=p.targetY=n.y;
  if(!options.sessionId){const profile=world.profile(p.playerId);profile.inventory.mushroom=3;(world as unknown as {commit:(id:string,p:Progress)=>void}).commit(p.playerId,profile);}
 }
}
const next=<T>(r:Room,event:string,match:(v:T)=>boolean=()=>true)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Missing '+event)),8000);const off=r.onMessage<T>(event,v=>{if(!match(v))return;clearTimeout(timer);off();resolve(v);});});
test('wire home ownership, confirmation, permanent craft receipt and private visitors across reconnect',async()=>{
 const http=createServer(),server=new Server({transport:new WebSocketTransport({server:http}),greet:false,gracefullyShutdown:false});server.define('cozy_test',CozyRoom);await server.listen(0,'127.0.0.1');const address=http.address() as AddressInfo,sdk=new Client('ws://127.0.0.1:'+address.port),rooms:Room[]=[];
 const join=async(options:object)=>{const r=await sdk.joinOrCreate('cozy_test',options);r.onMessage('*',()=>{});rooms.push(r);return r;};
 const sync=async(r:Room)=>{const p=next<WorldView>(r,'world:state');r.send('world:sync',{});return p;};
 const act=async(r:Room,msg:object)=>{const p=next<WorldView>(r,'world:state',v=>!!v.notice);r.send('world:action',msg);return p;};
 const deny=async(r:Room,msg:object)=>{const p=next<ApiError>(r,'api:error');r.send('world:action',msg);return p;};
 try{
  const a=await join({name:'Cozy A'}),b=await join({name:'Cozy B'}),authP=next<GuestReady>(a,'auth:ready');a.send('auth:sync',{});const auth=await authP;
  const craft={requestId:'wire-craft-once',nodeId:'cozy-home',verb:'home-craft',itemId:'forest-stool',confirmed:true,ownerId:'other',cost:{mushroom:0}};
  assert.equal((await deny(a,{...craft,confirmed:false})).code,'CONFIRM_REQUIRED');const saved=await act(a,craft);assert.equal(saved.progress.inventory.mushroom,0);assert.equal(saved.progress.cozy!.home.owned['forest-stool'],2);assert.equal((await act(a,craft)).progress.cozy!.home.owned['forest-stool'],2);
  assert.equal((await sync(b)).homes!.length,1);
  const placed=await act(a,{requestId:'wire-place-home',nodeId:'cozy-home',verb:'home-place',itemId:'forest-stool',x:1,y:1,rotation:0,confirmed:true});const uid=placed.progress.cozy!.home.placements[0].uid;
  assert.equal((await deny(b,{requestId:'wire-steal-home',nodeId:'cozy-home',verb:'home-remove',uid,ownerId:auth.playerId,confirmed:true})).code,'BAD_FURNITURE');
  assert.equal((await deny(a,{requestId:'wire-remote-project',nodeId:'cozy-community',verb:'project-contribute',projectId:'flower-garden',confirmed:true})).code,'TOO_FAR');
  await act(a,{requestId:'wire-open-house',nodeId:'cozy-home',verb:'home-access',open:true,confirmed:true});assert.equal((await sync(b)).homes!.length,2);
  await a.leave();const resumed=await join({name:'Cozy A',sessionId:auth.sessionId});const state=await sync(resumed);assert.equal(state.progress.cozy!.home.owned['forest-stool'],2);assert.equal(state.progress.cozy!.home.placements[0].uid,uid);assert.equal((await act(resumed,craft)).progress.cozy!.home.owned['forest-stool'],2);
 }finally{for(const r of rooms)if(r.connection.isOpen)await r.leave();await server.gracefullyShutdown(false);}
});
