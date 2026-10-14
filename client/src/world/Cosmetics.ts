import type Phaser from "phaser";
import { COSMETICS } from "../../../shared/regions";
import { FISH_SPECIES } from "../../../shared/nature";
/** Original grid-aligned overlays, shared by shop preview and actual avatars. */
export function cosmeticCanvas(id:string) {
  const canvas=document.createElement("canvas");canvas.width=18;canvas.height=24;
  const c=canvas.getContext("2d")!;c.imageSmoothingEnabled=false;
  const rect=(color:string,x:number,y:number,w:number,h:number)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  if(id==="none")return canvas;
  if(id==="cafe-apron") {rect("#425852",5,12,8,9);rect("#f6e9ca",6,12,6,8);rect("#bc8a67",7,15,4,3);return canvas;}
  const color=id==="straw-hat"?"#d7b969":id==="fisher-hat"?"#86aabd":id==="cat-hat"?"#c9b0a0":id==="chef-hat"?"#f6e9ca":"#90a477";
  rect("#4f473e",2,3,14,4);rect(color,3,2,12,4);rect(color,5,0,8,4);rect("#b77972",4,5,10,1);
  if(id==="cat-hat") {rect("#735a55",3,0,3,4);rect("#735a55",12,0,3,4);rect("#e1bab2",4,1,1,2);rect("#e1bab2",13,1,1,2);}
  if(id==="chef-hat"){rect("#ffffff",4,0,10,4);rect("#e5dcc7",4,3,10,2);}
  return canvas;
}
export function ensureCosmetics(scene:Phaser.Scene) {
  for(const cosmetic of COSMETICS)if(!scene.textures.exists("gear-"+cosmetic.id))scene.textures.addCanvas("gear-"+cosmetic.id,cosmeticCanvas(cosmetic.id));
}
export function itemCanvas(id:string) {
  const canvas=document.createElement("canvas");canvas.width=18;canvas.height=18;
  const c=canvas.getContext("2d")!,r=(color:string,x:number,y:number,w:number,h:number)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  if(id==="salad"||id==="soup") {
    r("#576b65",2,8,14,6);r("#e9dfc5",3,9,12,5);r("#d4c8ae",5,14,8,2);
    if(id==="salad"){r("#8faa70",4,5,10,5);r("#acc88d",6,3,5,5);r("#c97070",5,7,3,3);r("#e4a15d",10,5,3,3);}
    else {r("#d7a461",4,7,10,3);r("#b6c88a",6,7,2,2);r("#e4a15d",10,7,2,2);r("#f6e9ca",6,2,1,3);r("#f6e9ca",10,3,1,3);}
  }else if(id==="cafe-order"){r("#957654",4,2,10,14);r("#f6e9ca",5,3,8,12);r("#6c8269",7,5,4,1);r("#c9a77a",7,8,4,1);r("#c9a77a",7,11,4,1);}
  else if(id==="cafe-prepare"){r("#b28a60",2,6,14,9);r("#d3ae7c",3,7,12,7);r("#e4a15d",5,9,5,3);r("#8faa70",4,8,2,2);r("#e5e9dd",10,3,2,8);r("#61716c",10,11,2,4);}
  else if(id==="cafe-cook"){r("#728c84",3,7,12,7);r("#3b574e",2,6,14,2);r("#3b574e",1,8,2,3);r("#3b574e",15,8,2,3);r("#e4a15d",5,15,8,2);r("#f6e9ca",6,2,1,3);r("#f6e9ca",10,3,1,3);}
  else if(id==="cafe-serve"){r("#b8c9c0",2,12,14,2);r("#f6e9ca",4,9,10,3);r("#8faa70",5,6,8,4);r("#c97070",7,8,2,2);r("#b28a60",3,14,3,2);}
  else if(id==="butterfly"||id==="firefly"||id==="beetle") {
    const color=id==="beetle"?"#d6bc68":id==="firefly"?"#e9d581":"#83bfd4";
    r("#4d6051",8,3,2,12);r(color,3,4,4,5);r(color,11,4,4,5);r(color,4,10,3,4);r(color,11,10,3,4);
  }else if(id==="mushroom"){r("#d0af85",7,7,4,8);r("#b46572",3,4,12,6);r("#d38690",5,2,8,3);r("#f6e9ca",6,5,2,2);r("#f6e9ca",11,6,2,2);}
  else if(id==="carrot"||id==="tomato"||id==="wheat"){r("#82a765",8,2,2,6);r("#82a765",5,3,3,2);r(id==="tomato"?"#bf6671":id==="wheat"?"#d8bd77":"#dd9e64",5,8,8,5);r("#90a166",7,13,4,2);}
  else if(id==="shell"||id==="pearl"){r("#c28f92",4,5,10,8);r("#ecbdaf",5,3,8,10);r("#f6e9ca",7,5,2,7);r("#f6e9ca",10,6,2,6);}
  else if(id==="treasure"){r("#c1935d",3,6,12,8);r("#f4d780",3,6,12,2);r("#f4d780",8,8,2,3);}
  else if(id.includes("rabbit")||id.includes("animal")){r("#dac2ad",4,7,10,8);r("#dac2ad",5,2,3,6);r("#dac2ad",11,2,3,6);r("#604c48",6,10,1,2);r("#604c48",11,10,1,2);}
  else if(id==="camper"){r("#b9a178",3,8,12,6);r("#b9a178",6,5,6,4);r("#645843",8,9,3,5);}
  else if(id==="cleanup"){r("#89a96d",8,5,2,10);r("#aac77f",3,5,5,4);r("#aac77f",10,2,5,5);}
  else if(id==="chef"||id==="musician"||id==="voyager"){r("#657e87",4,7,10,7);r("#eed7a0",6,3,7,7);r("#f6e9ca",5,12,9,2);}
  else {
    const fish=FISH_SPECIES.find(f=>f.id===id),color=fish?.color??"#7ca8b7";
    if(id==="seahorse"){r(color,8,3,5,5);r(color,6,7,4,7);r(color,9,13,4,3);r("#334c51",11,4,1,1);}
    else {r(color,4,6,10,7);r(color,1,5,3,9);r("#bad4d8",7,4,4,2);r("#334c51",12,8,1,1);if(id==="clownfish"||id==="koi"){r("#f6e9ca",6,6,2,7);r("#f6e9ca",10,6,1,7);}}
  }
  return canvas;
}
