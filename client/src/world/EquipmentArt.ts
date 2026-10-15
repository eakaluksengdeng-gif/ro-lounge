import type Phaser from 'phaser';
import {GEAR_CATALOGUE,GEAR_SLOTS,SEASON_GEAR,type Equipment} from '../../../shared/equipment';
import {artImage} from '../reference/Assets';
import {cosmeticCanvas} from './Cosmetics';
import type {Dir,CharacterPose} from '../art';
export function wireEquipment(player:{equipment?:string;cosmetic?:string}):Equipment{
 let raw:Equipment={};try{if(player.equipment)raw=JSON.parse(player.equipment);else if(player.cosmetic&&player.cosmetic!=='none')raw={[player.cosmetic==='cafe-apron'?'body':'head']:player.cosmetic};}catch{return {};}
 const result:Equipment={};if(!raw||typeof raw!=='object')return result;for(const slot of GEAR_SLOTS)if(GEAR_CATALOGUE.some(g=>g.slot===slot&&g.id===raw[slot]))result[slot]=raw[slot];return result;
}
export function equipmentCanvas(e:Equipment,dir:Dir='down',pose:CharacterPose='standing',frame=0){
 const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
 const seated=pose!=='standing',feet=seated?51:56,hands=seated?42:43;
 if(e.feet){const image=artImage('equipment-'+e.feet);c.drawImage(image,0,0,48,96,14,feet,9,8);c.drawImage(image,48,0,48,96,25,feet+(frame===1?1:0),9,8);}
 if(e.body==='cafe-apron')c.drawImage(cosmeticCanvas(e.body),0,seated?-3:0);
 else if(e.body){const seasonal=SEASON_GEAR.some(g=>g.id===e.body),w=seasonal?(dir==='side'?25:30):25;c.drawImage(artImage('equipment-'+e.body),(48-w)/2,seated?33:35,w,23);}
 if(e.hands){const image=artImage('equipment-'+e.hands);c.drawImage(image,0,0,48,96,8,hands,7,10);c.drawImage(image,48,0,48,96,33,hands,7,10);}
 if(e.held&&pose!=='fishing')c.drawImage(artImage('equipment-'+e.held),dir==='up'?34:35,seated?32:29,13,30);
 if(e.head)c.drawImage(cosmeticCanvas(e.head,dir),0,0);
 return canvas;
}
export function ensureEquipmentTexture(scene:Phaser.Scene,e:Equipment,dir:Dir='down',pose:CharacterPose='standing',frame=0){
 const key='loadout-'+GEAR_SLOTS.map(s=>e[s]??'').join('_')+'-'+dir+'-'+pose+'-'+frame;
 if(!scene.textures.exists(key))scene.textures.addCanvas(key,equipmentCanvas(e,dir,pose,frame));return key;
}
