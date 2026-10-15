import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {Server,type Client as ServerClient} from 'colyseus';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,type Room} from 'colyseus.js';
import {TownRoom} from '../src/rooms/TownRoom';
import type {EnvironmentManager} from '../src/nature/EnvironmentManager';
import type {WorldView} from '../../shared/regions';
import type {ApiError,GuestReady} from '../../shared/pokdeng';
// Isolated test subclass only: no QA coordinates or spawn controls in production.
class BugRoom extends TownRoom{
 onJoin(client:ServerClient,options:any){super.onJoin(client,options);const env=(this as any).environment as EnvironmentManager;
  const animal=env.animals.get(options.testWild),p=this.state.players.get(client.sessionId)!;
  if(animal){animal.pauseUntil=Date.now()+60000;p.x=p.targetX=animal.x;p.y=p.targetY=animal.y;p.mapId='town';}
 }
}
const next=<T>(r:Room,event:string)=>new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Missing '+event)),6000);const off=r.onMessage<T>(event,v=>{clearTimeout(timer);off();resolve(v);});});
test('live socket insect catches use server entities, reject forgeries and persist per guest', {timeout:30000},async()=>{
 const http=createServer(),server=new Server({transport:new WebSocketTransport({server:http}),greet:false,gracefullyShutdown:false});server.define('bugs_test',BugRoom);await server.listen(0,'127.0.0.1');
 const sdk=new Client('ws://127.0.0.1:'+(http.address() as AddressInfo).port),rooms:Room[]=[];
 const join=async(options:object)=>{const r=await sdk.joinOrCreate('bugs_test',options);r.onMessage('*',()=>{});rooms.push(r);return r;};
 try{
  for(const [wildlifeId,item] of [['wild-6','butterfly'],['wild-9','bee'],['wild-11','ladybug']]){
   const room=await join({name:'Bug QA',testWild:wildlifeId});const ready=next<GuestReady>(room,'auth:ready');room.send('auth:sync',{});const auth=await ready;
   const bad=next<ApiError>(room,'api:error');room.send('world:action',{verb:'catch',requestId:'wire-unknown-'+wildlifeId,wildlifeId:'made-up',item:'bee',x:520,y:240});assert.equal((await bad).code,'BAD_WILDLIFE');
   const msg={verb:'catch',requestId:'wire-catch-'+wildlifeId,wildlifeId,amount:100000,item:'treasure',ownerId:'another-player'};
   const caught=next<WorldView>(room,'world:state');room.send('world:action',msg);const view=await caught;assert.equal(view.progress.inventory[item],1);assert.equal(view.progress.inventory.treasure,undefined);
   const duplicate=next<WorldView>(room,'world:state');room.send('world:action',msg);assert.equal((await duplicate).progress.inventory[item],1);
   const denied=next<ApiError>(room,'api:error');room.send('world:action',{...msg,wildlifeId: wildlifeId==='wild-6'?'wild-9':'wild-6',requestId:'wire-far-'+wildlifeId,x:0,y:0});assert.equal((await denied).code,'TOO_FAR');
   await room.leave();const resumed=await join({name:'Bug QA',sessionId:auth.sessionId,testWild:wildlifeId});const sync=next<WorldView>(resumed,'world:state');resumed.send('world:sync',{});assert.equal((await sync).progress.inventory[item],1);
   const cooldown=next<ApiError>(resumed,'api:error');resumed.send('world:action',{...msg,requestId:'wire-again-'+wildlifeId});assert.equal((await cooldown).code,'COOLDOWN');await resumed.leave();
  }
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.gracefullyShutdown(false);}
});
