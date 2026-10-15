import {COSMETICS,type Progress} from './regions';
export const GEAR_SLOTS=['head','body','held','hands','feet'] as const;
export type GearSlot=typeof GEAR_SLOTS[number];
export type Equipment=Partial<Record<GearSlot,string>>;
export const SLOT_NAMES:Record<GearSlot,string>={head:'หมวก',body:'เสื้อ / ชุด',held:'ของถือ',hands:'ถุงมือ',feet:'รองเท้า'};
export const NEW_GEAR=[
 {id:'woodland-boots',name:'รองเท้าป่าใบไม้',slot:'feet',quest:'forest'},
 {id:'butterfly-net',name:'สวิงจับผีเสื้อ',slot:'held',quest:'bugs'},
 {id:'garden-gloves',name:'ถุงมือชาวสวน',slot:'hands',quest:'carrots'},
 {id:'linen-apron',name:'ผ้ากันเปื้อนลินิน',slot:'body',quest:'harvest'},
 {id:'wooden-rod',name:'คันเบ็ดไม้',slot:'held',quest:'fish'},
 {id:'beach-sandals',name:'รองเท้าสานชายหาด',slot:'feet',quest:'shells'},
] as const;
export const SEASON_GEAR=[
 {id:'cream-knit',name:'เสื้อถักครีมอุ่นใจ',slot:'body',cost:{wheat:2,corn:2}},
 {id:'moss-hoodie',name:'ฮู้ดใบไม้มอส',slot:'body',cost:{eggplant:2,mushroom:2}},
 {id:'amber-raincoat',name:'เสื้อกันฝนอำพัน',slot:'body',cost:{pumpkin:2,shell:2}},
 {id:'berry-cardigan',name:'คาร์ดิแกนเบอร์รี',slot:'body',cost:{strawberry:3,tomato:1}},
] as const;
export const GEAR_CATALOGUE:{id:string;name:string;slot:GearSlot;quest?:string}[]=[
 ...COSMETICS.filter(c=>c.id!=='none').map(c=>({id:c.id,name:c.name,slot:(c.id==='cafe-apron'?'body':'head') as GearSlot})),...NEW_GEAR,
 ...SEASON_GEAR,
];
/** Additive legacy migration. An explicitly empty loadout means everything is removed. */
export function equipmentFor(p:Pick<Progress,'equipment'|'equipped'|'unlocks'>):Equipment{
 const candidate:Equipment=p.equipment??(p.equipped&&p.equipped!=='none'?{[p.equipped==='cafe-apron'?'body':'head']:p.equipped}:{});
 const result:Equipment={};for(const slot of GEAR_SLOTS){const item=GEAR_CATALOGUE.find(g=>g.id===candidate[slot]&&g.slot===slot);if(item&&p.unlocks.includes(item.id))result[slot]=item.id;}return result;
}
export function legacyCosmetic(equipment:Equipment){return equipment.head??(equipment.body==='cafe-apron'?'cafe-apron':'none');}
