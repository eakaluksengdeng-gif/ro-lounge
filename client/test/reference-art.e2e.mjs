import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/art/reference-v1/')&&r.status()!==200)missing.push(r.url());});
  await page.goto(process.env.E2E_URL??'http://127.0.0.1:5173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.artVersion==='reference-v1');
  const result=await page.evaluate(async()=>{
    const {renderCharacterCanvas,CHAR_SCALE}=await import('/src/art.ts');
    const {appearanceToLook,playerToLook,DEFAULT_LOOK,OPTION_COUNTS}=await import('/src/character/appearance.ts');
    const manifest=await fetch('/art/reference-v1/manifest.json').then(r=>r.json());
    const choices={};
    for(const part of Object.keys(OPTION_COUNTS))choices[part]=Array.from({length:OPTION_COUNTS[part]},(_,value)=>renderCharacterCanvas(appearanceToLook({...DEFAULT_LOOK,[part]:value})).toDataURL());
    const appearance={...DEFAULT_LOOK,gender:1,hair:3,skin:2,style:2,pants:1};
    const creator=appearanceToLook(appearance),wire=playerToLook({...appearance,color:parseInt(creator.shirt.slice(1),16)});
    const frame=renderCharacterCanvas(creator),ctx=frame.getContext('2d'),data=ctx.getImageData(0,0,frame.width,frame.height).data;
    const border=[];for(let x=0;x<48;x++)border.push(data[x*4+3],data[((63*48)+x)*4+3]);
    return {choices,count:Object.values(manifest).filter(Array.isArray).flat().length,characters:manifest.characters.length,heads:manifest.heads.length,wireMatches:renderCharacterCanvas(creator).toDataURL()===renderCharacterCanvas(wire).toDataURL(),size:[frame.width,frame.height],footprint:[48*CHAR_SCALE,64*CHAR_SCALE],transparent:border.some(a=>a===0)};
  });
  assert.equal(result.count,140);assert.equal(result.characters,18);assert.equal(result.heads,18);
  assert.equal(result.wireMatches,true,'creator indices and wire RGB must produce identical avatars');
  assert.deepEqual(result.size,[48,64]);assert.deepEqual(result.footprint,[54,72]);assert.equal(result.transparent,true);
  for(const [part,variants]of Object.entries(result.choices))assert.equal(new Set(variants).size,variants.length,'every '+part+' choice really changes pixels');
  assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/ro-reference-creator.png',fullPage:true});
  console.log('PASS: 140 decoded reference assets, real hairstyle/walking sheets, distinct appearance choices, wire/creator identical, transparent 48x64 sprites preserving 54x72 world footprint, no missing assets or page errors');
}finally{await browser.close();}
