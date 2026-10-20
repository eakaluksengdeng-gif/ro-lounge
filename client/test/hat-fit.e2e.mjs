import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';mkdirSync('data/hat-fit',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1200,height:960}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
 const result=await p.evaluate(async()=>{
  const {loadReferenceArt}=await import('/src/reference/Assets.ts');await loadReferenceArt();const {renderCharacterCanvas,characterTextureKey,ensureCharacter}=await import('/src/art.ts');const {equipmentCanvas}=await import('/src/world/EquipmentArt.ts');const {appearanceToLook}=await import('/src/character/appearance.ts');
  document.body.replaceChildren();document.body.style.cssText='background:#d9e8d0;display:block;color:#24342b;font:14px sans-serif';
  const heading=document.createElement('h2');heading.textContent='Clover Nook · hat fit · front / back / side';document.body.append(heading);let checked=0,trimmed=0,below=0;const cache=new Set();
  for(const head of ['camp-hat','straw-hat','fisher-hat','chef-hat','cat-hat']){
   const section=document.createElement('section');section.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px';const title=document.createElement('strong');title.textContent=head;title.style.width='100%';section.append(title);
   for(const gender of [0,1])for(const style of [0,1,2]){
    const look=appearanceToLook({color:3,hair:0,skin:0,pants:0,style,gender});
    ensureCharacter({textures:{exists:key=>cache.has(key),addCanvas(key){cache.add(key);return{setFilter(){}};}}},look,head);
    for(const dir of ['down','up','side'])for(const pose of ['standing','seated','fishing','prepare','cook','serve']){
     if(dir!=='down'&&['prepare','cook','serve'].includes(pose))continue;
     const naked=renderCharacterCanvas(look,dir,0,pose),base=renderCharacterCanvas(look,dir,0,pose,head),data=base.getContext('2d').getImageData(0,0,48,64).data,original=naked.getContext('2d').getImageData(0,0,48,64).data;
     for(let i=17*48*4;i<data.length;i++)if(data[i]!==original[i])below++;
     for(let i=0;i<17*48*4;i+=4)if(original[i+3]>0&&data[i+3]===0)trimmed++;
     base.getContext('2d').drawImage(equipmentCanvas({head},dir,pose),0,0);if(pose==='standing'){base.style.cssText='width:96px;height:128px;image-rendering:pixelated';base.title=`${gender}/${style}/${dir}`;section.append(base);}checked++;
    }
   }document.body.append(section);
  }
  return{checked,trimmed,below,cache:cache.size,key1:characterTextureKey({id:'a'},'side',0,'standing','camp-hat'),key2:characterTextureKey({id:'a'},'side',0,'standing')};
 });assert.equal(result.checked,360);assert.equal(result.below,0);assert.ok(result.trimmed>0);assert.equal(result.cache,450);assert.notEqual(result.key1,result.key2);assert.deepEqual(errors,[]);await p.screenshot({path:'data/hat-fit/all-hats.png',fullPage:true});console.log('PASS 360 supported hat/gender/hair/direction/pose combinations; lower hair/face/body unchanged; crown tucked; distinct live texture cache; no asset errors');
}finally{await b.close();}
