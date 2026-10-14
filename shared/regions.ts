/** Shared, deterministic world layout. Server owns position, proximity and rewards. */
export const MAP_IDS = ["town", "forest", "farm", "beach", "market"] as const;
export type MapId = typeof MAP_IDS[number];
export type Direction = "north" | "south" | "west" | "east";
export const WORLD_W = 1440, WORLD_H = 864;
export const MAP_NAMES: Record<MapId, string> = { town: "เมืองกลาง", forest: "ป่าน้ำตก", farm: "ฟาร์มเพื่อนรัก", beach: "หาดสายลม", market: "ตลาดโคมไฟ" };
export const MAP_COLORS: Record<MapId, number> = { town: 0x86b96c, forest: 0x577e54, farm: 0x9ab67c, beach: 0xe7ce93, market: 0x485451 };
export interface WorldNode { id: string; map: MapId; x: number; y: number; kind: "bug" | "mushroom" | "rare" | "camp" | "farm" | "greenhouse" | "animal" | "shell" | "treasure" | "cleanup" | "boat" | "cafe" | "shop" | "stage"; name: string; item?: string; }
export const WORLD_NODES: WorldNode[] = [
  { id:"bug-blue",map:"forest",x:420,y:350,kind:"bug",name:"จับผีเสื้อฟ้า",item:"butterfly" },
  { id:"bug-gold",map:"forest",x:1080,y:550,kind:"bug",name:"จับด้วงทอง",item:"beetle" },
  { id:"bug-firefly",map:"forest",x:1100,y:300,kind:"bug",name:"ตามหาหิ่งห้อย",item:"firefly" },
  { id:"mushroom-a",map:"forest",x:360,y:560,kind:"mushroom",name:"เก็บเห็ด",item:"mushroom" },
  { id:"mushroom-b",map:"forest",x:1080,y:680,kind:"mushroom",name:"เก็บเห็ดหอม",item:"mushroom" },
  { id:"forest-rare",map:"forest",x:420,y:190,kind:"rare",name:"สังเกตกระต่ายหิมะ",item:"snow-rabbit" },
  { id:"camp",map:"forest",x:900,y:390,kind:"camp",name:"นั่งแคมป์กับเพื่อน" },
  { id:"farm-plots",map:"farm",x:490,y:460,kind:"farm",name:"แปลงผักและเพื่อนบ้าน" },
  { id:"greenhouse",map:"farm",x:1050,y:330,kind:"greenhouse",name:"โรงเรือน" },
  { id:"animal-garden",map:"farm",x:1030,y:580,kind:"animal",name:"ให้อาหารแมวกับกระต่าย" },
  { id:"shell-a",map:"beach",x:390,y:530,kind:"shell",name:"เก็บเปลือกหอย",item:"shell" },
  { id:"shell-b",map:"beach",x:700,y:540,kind:"shell",name:"เก็บหอยมุก",item:"pearl" },
  { id:"treasure",map:"beach",x:420,y:340,kind:"treasure",name:"ขุดสมบัติริมทะเล",item:"treasure" },
  { id:"cleanup-a",map:"beach",x:800,y:320,kind:"cleanup",name:"ช่วยเก็บขยะชายหาด",item:"cleanup" },
  { id:"cleanup-b",map:"beach",x:600,y:440,kind:"cleanup",name:"ช่วยเก็บขยะชายหาด",item:"cleanup" },
  { id:"boat",map:"beach",x:1080,y:570,kind:"boat",name:"ล่องเรือกับเพื่อน" },
  { id:"cafe",map:"market",x:430,y:540,kind:"cafe",name:"คาเฟ่ทำอาหาร 2–4 คน" },
  { id:"shop",map:"market",x:1020,y:500,kind:"shop",name:"ร้านแลกชุดและหมวก" },
  { id:"stage",map:"market",x:970,y:300,kind:"stage",name:"เวทีดนตรี" },
];
export const SEEDS = [
  { id:"carrot",name:"แครอท",growMs:60000,color:0xe4a15d },
  { id:"tomato",name:"มะเขือเทศ",growMs:90000,color:0xc97070 },
  { id:"wheat",name:"ข้าวสาลี",growMs:120000,color:0xe0c570 },
] as const;
export type SeedId = typeof SEEDS[number]["id"];
export const ITEMS: Record<string, { name: string; icon: string; category: string }> = {
  butterfly:{name:"ผีเสื้อฟ้า",icon:"🦋",category:"แมลง"},beetle:{name:"ด้วงทอง",icon:"🪲",category:"แมลง"},
  firefly:{name:"หิ่งห้อย",icon:"✨",category:"แมลง"},mushroom:{name:"เห็ดป่า",icon:"🍄",category:"ของป่า"},
  "snow-rabbit":{name:"กระต่ายหิมะที่พบ",icon:"🐇",category:"สัตว์"}, "animal-friend":{name:"เพื่อนสัตว์",icon:"🐱",category:"สัตว์"},
  shell:{name:"เปลือกหอย",icon:"🐚",category:"ชายหาด"},pearl:{name:"หอยมุก",icon:"🦪",category:"ชายหาด"},
  treasure:{name:"ของจากสมบัติ",icon:"💎",category:"ชายหาด"},cleanup:{name:"ช่วยชายหาด",icon:"🌱",category:"ชายหาด"},
  carrot:{name:"แครอท",icon:"🥕",category:"ผลผลิต"},tomato:{name:"มะเขือเทศ",icon:"🍅",category:"ผลผลิต"},wheat:{name:"ข้าวสาลี",icon:"🌾",category:"ผลผลิต"},
  chef:{name:"ร่วมเสิร์ฟสำเร็จ",icon:"🍽️",category:"กิจกรรม"},musician:{name:"เล่นเวทีดนตรี",icon:"🎵",category:"กิจกรรม"},
  voyager:{name:"ล่องเรือ",icon:"⛵",category:"กิจกรรม"},camper:{name:"นั่งแคมป์",icon:"🏕️",category:"กิจกรรม"},
};
export const COSMETICS = [
  { id:"none",name:"ไม่ใส่หมวก",icon:"🙂",cost:{} },
  { id:"camp-hat",name:"หมวกแคมป์",icon:"🏕️",cost:{mushroom:3,butterfly:2} },
  { id:"straw-hat",name:"หมวกฟาง",icon:"👒",cost:{carrot:2,wheat:2} },
  { id:"fisher-hat",name:"หมวกชาวทะเล",icon:"🎣",cost:{shell:3,pearl:1} },
  { id:"chef-hat",name:"หมวกเชฟ",icon:"👨‍🍳",cost:{chef:1} },
  { id:"cat-hat",name:"หมวกแมว",icon:"🐱",cost:{"animal-friend":2} },
  { id:"cafe-apron",name:"ผ้ากันเปื้อนคาเฟ่",icon:"🧑‍🍳",cost:{chef:2} },
] as const;
export interface Crop { seed: SeedId; plantedAt: number; readyAt: number; watered: boolean; }
export interface Progress { map: MapId; inventory: Record<string,number>; discovered: string[]; plots:(Crop|null)[];
  allowHelp:boolean; unlocks:string[]; equipped:string; cooldowns:Record<string,number>; receipts?:Record<string,string>; }
export interface CafeMember { id:string;name:string;actions:number; }
export interface CafeView { phase:"lobby"|"running"|"result"; members:CafeMember[]; host:string|null; deadline:number|null; order:number; served:number; recipe:string; roundId:string|null; }
export interface BoatView { departAt:number;returnAt:number;members:string[]; }
export interface WorldView { map:MapId;serverTime:number;progress:Progress; farms:{id:string;name:string;allowHelp:boolean;plots:(Crop|null)[]}[];
  cafe:CafeView;boat:BoatView|null;cleanup:number; notice?:string; }
export function mapId(value:unknown): value is MapId { return MAP_IDS.includes(value as MapId); }
export function exitDirection(x:number,y:number):Direction|null {
  if (Math.abs(x-WORLD_W/2)<100 && y<=100) return "north";
  if (Math.abs(x-WORLD_W/2)<100 && y>=WORLD_H-72) return "south";
  if (Math.abs(y-WORLD_H/2)<100 && x<=70) return "west";
  if (Math.abs(y-WORLD_H/2)<100 && x>=WORLD_W-70) return "east";
  return null;
}
export function destination(map:MapId,d:Direction):MapId|null {
  if(map==="town") return ({north:"forest",south:"beach",west:"farm",east:"market"} as const)[d];
  return ({forest:"south",beach:"north",farm:"east",market:"west"} as const)[map]===d?"town":null;
}
export function arrival(map:MapId,from:MapId) {
  if(from==="town") return map==="forest"?{x:720,y:740}:map==="beach"?{x:720,y:145}:map==="farm"?{x:1280,y:432}:{x:150,y:432};
  return from==="forest"?{x:720,y:160}:from==="beach"?{x:720,y:730}:from==="farm"?{x:150,y:432}:{x:1280,y:432};
}
export function worldBlocked(map:MapId,x:number,y:number) {
  if (map==="beach") return y>620 && !(x>=1044&&x<=1116&&y<=792);
  if (map==="forest") return ((x-780)/180)**2+((y-210)/75)**2<1 || (x>590&&x<625&&y>90&&y<310);
  if (map==="farm") return x>930&&x<1140&&y>160&&y<275;
  if (map==="market") return (x>290&&x<560&&y>270&&y<435) || (x>890&&x<1120&&y>360&&y<440);
  return false;
}
export function beachFishingLocation(x:number,y:number) {
  if (x<48||x>1392) return null;
  if (y>=575&&y<=620) return {bobberX:x,bobberY:660};
  if (x>=1044&&x<=1116&&y>620&&y<=792) return {bobberX:x<1080?x-60:x+60,bobberY:y};
  return null;
}
export function boatPosition(departAt:number,now:number) {
  const t=Math.max(0,Math.min(1,(now-departAt)/20000));
  return {x:1080-Math.sin(t*Math.PI)*260,y:650+Math.sin(t*Math.PI)*115};
}
