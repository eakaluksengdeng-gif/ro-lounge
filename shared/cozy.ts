/** Server-owned recipes and progression; these activities never mint chips. */
export const RECIPES = [
  {id:'garden-salad',name:'สลัดสวน',cost:{carrot:1,tomato:1},xp:8},
  {id:'forest-soup',name:'ซุปเห็ดอุ่นใจ',cost:{mushroom:2,carrot:1},xp:10},
  {id:'fish-soup',name:'ซุปปลาสด',cost:{carp:1,carrot:1},xp:12},
  {id:'picnic-bread',name:'ขนมปังปิกนิก',cost:{wheat:2},xp:8},
] as const;
export const FURNITURE = [
  {id:'flower-pot',name:'กระถางดอกไม้',icon:'🌷',cost:{carrot:2,shell:1}},
  {id:'shell-lamp',name:'โคมไฟเปลือกหอย',icon:'🐚',cost:{shell:3,pearl:1}},
  {id:'forest-stool',name:'เก้าอี้ป่า',icon:'🪑',cost:{mushroom:3}},
  {id:'picnic-rug',name:'พรมปิกนิก',icon:'🧺',cost:{wheat:3}},
  {id:'aquarium',name:'ตู้ปลาน้อย',icon:'🐠',cost:{carp:1,shell:2}},
  {id:'festival-lantern',name:'โคมไฟเทศกาล',icon:'🏮',cost:null},
] as const;
export const TOWN_PROJECTS = [
  {id:'flower-garden',name:'สวนดอกไม้กลางเมือง',item:'carrot',goal:30},
  {id:'shore-lights',name:'โคมไฟริมหาด',item:'shell',goal:40},
  {id:'forest-rest',name:'มุมพักผ่อนในป่า',item:'mushroom',goal:30},
] as const;
export interface HomePlacement {uid:string;item:string;x:number;y:number;rotation:number;}
export interface HomeState {owned:Record<string,number>;placements:HomePlacement[];open:boolean;}
export interface CozyProgress {home:HomeState;festival:{week:number;points:number;claimed:boolean};picnicId?:string;}
export interface PicnicView {id:string;endsAt:number;members:string[];claimed:string[];}
export interface CommunityView {projects:Record<string,number>;contributions:Record<string,number>;picnic:PicnicView|null;week:number;}
export const cozyFresh=():CozyProgress=>({home:{owned:{'forest-stool':1,'picnic-rug':1},placements:[],open:false},festival:{week:-1,points:0,claimed:false}});
export const festivalWeek=(now:number)=>Math.floor(now/(7*86400000));
export const FESTIVAL_GOAL=10;
