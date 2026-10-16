import type Phaser from 'phaser';
import type {WorldNode} from '../../../shared/regions';
import {artImage} from '../reference/Assets';
import {blockedForMap} from './PathPlanner';
/** Small physical wayfinding, never a title plaque under the player's feet. */
const LANDMARKS:Record<string,string>={orders:'icon-cafe-order',museum:'icon-butterfly',home:'furniture-forest-stool',community:'furniture-festival-lantern'};
export function addActivityMarker(scene:Phaser.Scene,node:WorldNode){
 const asset=LANDMARKS[node.kind];if(!asset)return;
 const offset=[[-35,-12],[35,-12],[-35,24],[35,24]].find(([dx,dy])=>!blockedForMap(node.map,node.x+dx,node.y+dy+18))??[35,-12];
 const x=node.x+offset[0],y=node.y+offset[1];
 scene.add.graphics().fillStyle(0x634631).fillRect(x-3,y-3,6,21).fillStyle(0xa67b48).fillRect(x-1,y-3,2,21).setDepth(y+18);
 const board=scene.add.image(x,y-8,'board').setDisplaySize(44,27).setDepth(y+19);board.setData('worldMarker',node.id);
 const key='landmark-'+asset;if(!scene.textures.exists(key))scene.textures.addImage(key,artImage(asset));
 scene.add.image(x,y-8,key).setDisplaySize(20,20).setDepth(y+20).setData('worldMarkerIcon',node.id);
}
