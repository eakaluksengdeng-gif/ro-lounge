import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';mkdirSync('data/female-neck',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:780,height:360}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 const result=await p.evaluate(async()=>{
  const {renderCharacterCanvas}=await import('/src/art.ts'),{appearanceToLook,DEFAULT_LOOK}=await import('/src/character/appearance.ts'),{equipmentCanvas}=await import('/src/world/EquipmentArt.ts');
  const failures=[];let count=0;for(let style=0;style<3;style++)for(let skin=0;skin<3;skin++)for(let frame=0;frame<3;frame++)for(const pose of ['standing','seated','fishing','prepare','cook','serve'])for(const head of [undefined,'camp-hat','straw-hat','fisher-hat','chef-hat','cat-hat']){
   const look=appearanceToLook({...DEFAULT_LOOK,gender:1,style,skin}),c=renderCharacterCanvas(look,'down',frame,pose,head);c.getContext('2d').drawImage(equipmentCanvas({head},'down',pose,frame),0,0);const data=c.getContext('2d').getImageData(0,0,48,64).data,n=parseInt(look.skin.slice(1),16),expected=[n>>16,(n>>8)&255,n&255,255];
   // Opacity alone missed the bug: the old closed outline was fully opaque.
   // Require an actual unbroken skin-colour path through both stacked seams.
   for(let y=39;y<=41;y++){const i=(y*48+24)*4;if(!expected.every((v,j)=>data[i+j]===v))failures.push({style,skin,frame,pose,head,y});}count++;
  }
  document.body.replaceChildren();document.body.style.cssText='display:flex;background:#c6d9b5;margin:0';for(let style=0;style<3;style++){const c=renderCharacterCanvas(appearanceToLook({...DEFAULT_LOOK,gender:1,style}));c.style.cssText='width:240px;height:320px;image-rendering:pixelated';document.body.append(c);}return{count,failures};
 });assert.equal(result.count,972);assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);await p.screenshot({path:'data/female-neck/after.png'});console.log('PASS 972 female hairstyle/skin/walk/pose/hat combinations: connected skin at collar, not merely opaque pixels');
}finally{await b.close();}
