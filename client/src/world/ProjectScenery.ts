import type Phaser from 'phaser';
import type {MapId,WorldView} from '../../../shared/regions';
import {TOWN_PROJECTS} from '../../../shared/cozy';
import {artImage} from '../reference/Assets';
/** Decorative-only upgrades do not silently change server collision geometry. */
export class ProjectScenery {
 private signature='';private objects:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){}
 clear(){for(const object of this.objects)object.destroy();this.objects=[];this.signature='';}
 update(map:MapId,view?:WorldView){
  const completed=TOWN_PROJECTS.filter(p=>(view?.community?.projects[p.id]??0)>=p.goal).map(p=>p.id);const signature=map+completed.join();if(this.signature===signature)return;this.clear();this.signature=signature;
  const image=(asset:string,x:number,y:number,w:number,h=w)=>{const key='project-'+asset;if(!this.scene.textures.exists(key))this.scene.textures.addImage(key,artImage(asset));this.objects.push(this.scene.add.image(x,y,key).setDisplaySize(w,h).setOrigin(.5,.9).setDepth(y));};
  if(map==='town'&&completed.includes('flower-garden'))for(const [x,y]of [[654,394],[786,394],[645,477],[795,477]])image('prop-bush-pink',x,y,42,36);
  if(map==='beach'&&completed.includes('shore-lights'))for(const x of [490,610,730,850])image('prop-lamp',x,570,32,72);
  if(map==='forest'&&completed.includes('forest-rest')){image('prop-bench',1000,450,84,54);image('prop-bush-white',1050,450,44,38);image('prop-lamp',1040,390,32,72);}
 }
}
