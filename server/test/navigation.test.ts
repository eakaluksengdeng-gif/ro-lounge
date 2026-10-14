import test from "node:test";
import assert from "node:assert/strict";
import { planRoute, blockedForMap } from "../../client/src/world/PathPlanner";
import { isBlocked } from "../src/world";
test("automatic town navigation avoids pond, fountain, trees and unintended casino entries from every arrival",()=>{
  for(const start of [{x:720,y:160},{x:150,y:432},{x:1280,y:432},{x:720,y:730},{x:1139.8,y:506.7}])for(const goal of [{x:24,y:432},{x:720,y:90},{x:720,y:800},{x:1408,y:432},{x:456,y:648},{x:960,y:432}]){
    const route=planRoute("town",start,goal);assert.ok(route.length>0,JSON.stringify({start,goal}));let previous=start;
    for(const target of route){const steps=Math.ceil(Math.hypot(target.x-previous.x,target.y-previous.y)/3);
      for(let i=0;i<=steps;i++){const k=steps?i/steps:0;assert.equal(isBlocked(previous.x+(target.x-previous.x)*k,previous.y+(target.y-previous.y)*k),false,JSON.stringify({start,goal,target}));}
      previous=target;
    }
    assert.ok(Math.hypot(previous.x-goal.x,previous.y-goal.y)<2);
  }
});
test("players can leave the Boardgame doorstep, and a blocked water click routes to reachable shore",()=>{
  assert.ok(planRoute("town",{x:960,y:432},{x:650,y:576}).length>0);
  const route=planRoute("town",{x:650,y:576},{x:264,y:648});assert.ok(route.length>0);
  const last=route[route.length-1];assert.equal(blockedForMap("town",last.x,last.y),false);
});
