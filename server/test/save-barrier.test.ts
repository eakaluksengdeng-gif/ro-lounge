import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "colyseus.js";
import { TownRoom } from "../src/rooms/TownRoom";
import { initializeServices, storage, economy } from "../src/services";
import type { GuestReady, WalletView } from "../../shared/pokdeng";
test("real sockets cannot read an unconfirmed reward through wallet:sync or auth:sync during a cloud save", {timeout:15000},async()=>{
  const fetchBefore=globalThis.fetch,urlBefore=process.env.SUPABASE_URL,keyBefore=process.env.SUPABASE_SECRET_KEY;
  let row:any={version:1,data:{}},revision=0,last="",hold=false,release:(()=>void)|undefined;
  globalThis.fetch=(async(_url:any,options:any)=>{
    if(!String(_url).startsWith("https://test.supabase.co/"))return fetchBefore(_url,options);
    if(options.method==="GET")return new Response(JSON.stringify([{revision,snapshot:row}]),{status:200});
    if(hold)await new Promise<void>(resolve=>{release=resolve;});
    const payload=JSON.parse(options.body);
    if(payload.operation_id!==last){assert.equal(payload.expected_revision,revision);last=payload.operation_id;row=payload.new_snapshot;revision++;}
    return new Response(JSON.stringify(revision),{status:200});
  }) as typeof fetch;
  process.env.SUPABASE_URL="https://test.supabase.co";process.env.SUPABASE_SECRET_KEY="sb_secret_qa";
  const http=createServer(),server=new Server({transport:new WebSocketTransport({server:http}),greet:false,gracefullyShutdown:false});
  let room:any;
  try{
    await initializeServices();server.define("town_save_qa",TownRoom);await server.listen(0,"127.0.0.1");
    const sdk=new Client("ws://127.0.0.1:"+(http.address() as AddressInfo).port);room=await sdk.joinOrCreate("town_save_qa",{name:"Save QA"});room.onMessage("*",()=>{});
    const guest=await new Promise<GuestReady>(resolve=>{const off=room.onMessage("auth:ready",(g:GuestReady)=>{off();resolve(g);});room.send("auth:sync",{});});
    const walletMessages:WalletView[]=[],authMessages:GuestReady[]=[];
    room.onMessage("wallet:update",(wallet:WalletView)=>walletMessages.push(wallet));room.onMessage("auth:ready",(g:GuestReady)=>authMessages.push(g));
    hold=true;const operation=storage.run(()=>economy.rewardFishingCatch(guest.playerId,"barrier-catch",10));
    for(let i=0;i<100&&!release;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(release,"remote writer is held before confirmation");
    room.send("wallet:sync",{});room.send("auth:sync",{});await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(walletMessages.some(w=>w.balance===110),false);assert.equal(authMessages.some(g=>g.wallet.balance===110),false);
    hold=false;release!();await operation;
    for(let i=0;i<100&&!walletMessages.some(w=>w.balance===110);i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(walletMessages.some(w=>w.balance===110),true);assert.equal(row.data.wallets.balances[guest.playerId],110);
  }finally{
    hold=false;release?.();if(room)await room.leave().catch(()=>{});await server.gracefullyShutdown(false);globalThis.fetch=fetchBefore;
    if(urlBefore===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=urlBefore;
    if(keyBefore===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=keyBefore;
  }
});
