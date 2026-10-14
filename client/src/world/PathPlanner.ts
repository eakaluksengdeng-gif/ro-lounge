import { CASINO_BUILDING, CASINO_DOOR } from "../../../shared/casinoWorld";
import { worldBlocked, type MapId } from "../../../shared/regions";
import { TREES, treeFeet, POND, FOUNTAIN, TILE_PX, MAP_W, MAP_H } from "../world";
type Point={x:number;y:number};
const STEP=24,COLS=60,ROWS=36;
export function blockedForMap(map:MapId,x:number,y:number,avoidDoor=false) {
  if(x<24||x>MAP_W-24||y<72||y>MAP_H-8)return true;
  if(map!=="town")return worldBlocked(map,x,y);
  const h=CASINO_BUILDING;
  if(x>h.x-8&&x<h.x+h.width+8&&y>h.y&&y<h.y+h.height+8)return true;
  if(((x/TILE_PX-POND.cx)/POND.rx)**2+((y/TILE_PX-POND.cy)/POND.ry)**2<.95)return true;
  if(((x-FOUNTAIN.x)/54)**2+((y-FOUNTAIN.y-18)/32)**2<1)return true;
  if(TREES.some(t=>Math.hypot(x-treeFeet(t).x,y-treeFeet(t).y)<18))return true;
  return avoidDoor&&Math.hypot(x-CASINO_DOOR.x,y-CASINO_DOOR.y)<46;
}
export function planRoute(map:MapId,start:Point,destination:Point):Point[] {
  const goal={x:Math.min(MAP_W-24,Math.max(24,destination.x)),y:Math.min(MAP_H-8,Math.max(72,destination.y))};
  const avoid=map==="town"&&Math.hypot(start.x-CASINO_DOOR.x,start.y-CASINO_DOOR.y)>46&&Math.hypot(goal.x-CASINO_DOOR.x,goal.y-CASINO_DOOR.y)>60;
  const blocked=(p:Point)=>blockedForMap(map,p.x,p.y,avoid);
  const clear=(a:Point,b:Point)=>{const count=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/4);for(let i=0;i<=count;i++){const k=count?i/count:0;if(blocked({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k}))return false;}return true;};
  if(!blocked(goal)&&clear(start,goal))return[goal];
  const point=(key:number):Point=>({x:(key%COLS)*STEP+STEP/2,y:Math.floor(key/COLS)*STEP+STEP/2});
  const nearest=(origin:Point,needsConnection:boolean)=>{
    const cx=Math.floor(origin.x/STEP),cy=Math.floor(origin.y/STEP),candidates:number[]=[];
    for(let y=Math.max(0,cy-4);y<Math.min(ROWS,cy+5);y++)for(let x=Math.max(0,cx-4);x<Math.min(COLS,cx+5);x++){
      const key=y*COLS+x,p=point(key);if(!blocked(p)&&(!needsConnection||clear(origin,p)))candidates.push(key);
    }
    candidates.sort((a,b)=>Math.hypot(point(a).x-origin.x,point(a).y-origin.y)-Math.hypot(point(b).x-origin.x,point(b).y-origin.y));
    return candidates[0];
  };
  const first=nearest(start,true),last=nearest(goal,!blocked(goal));if(first===undefined||last===undefined)return[];
  const score=new Map<number,number>([[first,0]]),parents=new Map<number,number>(),closed=new Set<number>();
  const heap:{key:number;f:number}[]=[];
  const push=(entry:{key:number;f:number})=>{heap.push(entry);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=entry.f)break;heap[i]=heap[p];i=p;}heap[i]=entry;};
  const pop=()=>{const first=heap[0],end=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=end.f)break;heap[i]=heap[child];i=child;}heap[i]=end;}return first;};
  const h=(key:number)=>Math.hypot(point(key).x-point(last).x,point(key).y-point(last).y);
  push({key:first,f:h(first)});
  while(heap.length){
    const {key}=pop();if(closed.has(key))continue;if(key===last){
      const route:Point[]=[point(last)];let at=last;while(parents.has(at)){at=parents.get(at)!;route.unshift(point(at));}
      if(!blocked(goal)&&clear(route[route.length-1],goal))route.push(goal);
      // Remove redundant steps only when the entire segment is safe.
      const short:Point[]=[];let cursor=start,index=0;
      while(index<route.length){let furthest=index;for(let i=index+1;i<route.length;i++){if(clear(cursor,route[i]))furthest=i;else break;}short.push(route[furthest]);cursor=route[furthest];index=furthest+1;}
      return short;
    }
    closed.add(key);const p=point(key),x=key%COLS,y=Math.floor(key/COLS);
    for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){
      const nx=x+dx,ny=y+dy;if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const next=ny*COLS+nx,np=point(next);
      if(closed.has(next)||blocked(np)||!clear(p,np))continue;
      const cost=score.get(key)!+Math.hypot(dx,dy)*STEP;if(cost>=(score.get(next)??Infinity))continue;
      score.set(next,cost);parents.set(next,key);push({key:next,f:cost+h(next)});
    }
  }
  return [];
}
