export const VILLAGE_ORDERS=[
 {id:'forest',name:'เสบียงสำหรับแคมป์',npc:'นักเดินป่า',skill:'nature',cost:{mushroom:2},xp:20,reward:'camp-hat'},
 {id:'bugs',name:'สำรวจสวนแมลง',npc:'นักธรรมชาติ',skill:'nature',cost:{bee:1,beetle:1},xp:25,reward:null},
 {id:'carrots',name:'ตะกร้าผักให้คาเฟ่',npc:'แม่ครัว',skill:'garden',cost:{carrot:2},xp:20,reward:'straw-hat'},
 {id:'harvest',name:'วัตถุดิบมื้อเย็น',npc:'แม่ครัว',skill:'garden',cost:{tomato:2,wheat:1},xp:30,reward:'chef-hat'},
 {id:'fish',name:'ปลาสดสำหรับซุป',npc:'พ่อครัว',skill:'fishing',cost:{carp:1,carrot:1},xp:25,reward:'fisher-hat'},
 {id:'shells',name:'ของแต่งมุมชายหาด',npc:'ช่างหมู่บ้าน',skill:'explore',cost:{shell:2},xp:20,reward:null},
] as const;
export const SKILL_NAMES:Record<string,string>={nature:'ธรรมชาติ',garden:'ทำสวน',fishing:'ตกปลา',explore:'สำรวจ'};
export const ORDER_COOLDOWN=86400000;
export interface VillageProgress {xp:Record<string,number>;completed:string[];museum:string[];}
export const villageLevel=(xp:number)=>1+Math.floor(Math.sqrt(Math.max(0,xp)/25));
