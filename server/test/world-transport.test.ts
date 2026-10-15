import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server, type Client as ServerClient } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "colyseus.js";
import { TownRoom } from "../src/rooms/TownRoom";
import { world } from "../src/services";
import { WORLD_NODES, type WorldView, type MapId } from "../../shared/regions";
import type { GuestReady, ApiError } from "../../shared/pokdeng";
class TestWorldRoom extends TownRoom {
  onJoin(client:ServerClient,options:any) {
    super.onJoin(client,options);
    const p=this.state.players.get(client.sessionId)!;
    const node=WORLD_NODES.find(n=>n.id===options.testNode);
    if(node){p.mapId=node.map;p.x=p.targetX=node.x;p.y=p.targetY=node.y;world.travel(p.playerId,node.map);}
  }
}
function next<T>(room:Room,event:string,match:(x:T)=>boolean=()=>true) {
  return new Promise<T>((resolve,reject)=>{const timeout=setTimeout(()=>{off();reject(new Error("Missing "+event));},5000);
    const off=room.onMessage<T>(event,x=>{if(!match(x))return;clearTimeout(timeout);off();resolve(x);});});
}
test("real transport world auth/proximity/replay, private inventories, farm ownership, cafe join and map-local chat", {timeout:30000},async()=>{
  const http=createServer(),server=new Server({transport:new WebSocketTransport({server:http}),greet:false,gracefullyShutdown:false});
  server.define("world_test",TestWorldRoom);await server.listen(0,"127.0.0.1");
  const sdk=new Client("ws://127.0.0.1:"+(http.address() as AddressInfo).port),rooms:Room[]=[];
  const join=async(options:object)=>{const r=await sdk.joinOrCreate("world_test",options);r.onMessage("*",()=>{});rooms.push(r);return r;};
  try{
    const owner=await join({name:"Owner",testNode:"farm-plots"}),helper=await join({name:"Helper",testNode:"farm-plots"});
    const authA=next<GuestReady>(owner,"auth:ready");owner.send("auth:sync",{});const a=await authA;
    const authB=next<GuestReady>(helper,"auth:ready");helper.send("auth:sync",{});const b=await authB;
    let seq=0;
    const act=async(room:Room,verb:string,nodeId:string,extra:object={})=>{
      const response=next<WorldView>(room,"world:state",v=>!!v.notice);room.send("world:action",{verb,nodeId,requestId:"wire-action-"+(++seq),...extra});return response;
    };
    await act(owner,"plant","farm-plots",{slot:0,seed:"carrot"});
    const rejected=next<ApiError>(helper,"api:error");helper.send("world:action",{requestId:"wire-forged-owner",verb:"harvest",nodeId:"farm-plots",ownerId:a.playerId,playerId:a.playerId,slot:0});
    assert.equal((await rejected).code,"NOT_OWNER");
    const denied=next<ApiError>(helper,"api:error");helper.send("world:action",{requestId:"wire-forged-help",verb:"water",nodeId:"farm-plots",ownerId:a.playerId,slot:0});assert.equal((await denied).code,"NO_PERMISSION");
    await act(owner,"allow-help","farm-plots",{allow:true});
    const watered=await act(helper,"water","farm-plots",{ownerId:a.playerId,slot:0});assert.equal(watered.farms.find(f=>f.id===a.playerId)?.plots[0]?.watered,true);
    assert.equal(watered.progress.water,1,'helper spends their own water');
    const ownerView=next<WorldView>(owner,'world:state');owner.send('world:sync',{});assert.equal((await ownerView).progress.water,2,'owner water is not spent by helper');
    assert.ok(!JSON.stringify(watered).includes(a.sessionId)&&!JSON.stringify(watered).includes(b.sessionId));
    assert.equal("wallet" in watered,false);
    const far=next<ApiError>(owner,"api:error");owner.send("world:action",{requestId:"wire-distant-action",verb:"collect",nodeId:"mushroom-a",x:360,y:560,map:"forest"});assert.equal((await far).code,"WRONG_MAP");
    const travel=next<ApiError>(owner,"api:error");owner.send("world:travel",{direction:"west",map:"town"});assert.equal((await travel).code,"NOT_AT_EXIT");
    const forest=await join({name:"Forest",testNode:"mushroom-a"});
    const gathered=await act(forest,"collect","mushroom-a",{requestId:"wire-collect-once",amount:9999});assert.equal(gathered.progress.inventory.mushroom,1);
    const repeated=await act(forest,"collect","mushroom-a",{requestId:"wire-collect-once"});assert.equal(repeated.progress.inventory.mushroom,1);
    let crossChat=false;forest.onMessage("chat",()=>{crossChat=true;});
    const local=next<{text:string}>(helper,"chat");owner.send("chat",{text:"farm-only"});assert.equal((await local).text,"farm-only");
    await new Promise(resolve=>setTimeout(resolve,100));assert.equal(crossChat,false);
    const ca=await join({name:"Chef A",testNode:"cafe"}),cb=await join({name:"Chef B",testNode:"cafe"});
    await act(ca,"cafe-join","cafe");await act(cb,"cafe-join","cafe");
    const started=await act(ca,"cafe-start","cafe");assert.equal(started.cafe.members.length,2);assert.equal(started.cafe.phase,"running");
    const stale=next<ApiError>(cb,"api:error");cb.send("world:action",{requestId:"wire-stale-kitchen",verb:"cafe-work",nodeId:"cafe",roundId:"forged",station:0});assert.equal((await stale).code,"STALE_ROUND");
  }finally{for(const room of rooms)await room.leave().catch(()=>{});await server.gracefullyShutdown(false);}
});
