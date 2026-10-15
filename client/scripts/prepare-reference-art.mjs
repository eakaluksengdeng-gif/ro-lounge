/** Asset conditioning only: crop generated atlases, align frames, nearest-neighbor resize.
 * Creative edits belong in ImageGen. Sources are retained for reproducible exports. */
import sharp from 'sharp';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source=fileURLToPath(new URL('../art-source/reference-v1/',import.meta.url));
const output=fileURLToPath(new URL('../public/art/reference-v1/',import.meta.url));
await mkdir(output,{recursive:true});
const manifest={version:'reference-v1',characters:[],heads:[],props:[],terrain:[],wildlife:[],icons:[],ui:[]};
async function atlas(name){await access(source+name+'-source.png');const {data,info}=await sharp(source+name+'-source.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,...info};}
function bounds(a,x0,y0,x1,y1){let left=x1,top=y1,right=x0,bottom=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(a.data[(y*a.width+x)*4+3]>180){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>right)throw new Error('Empty atlas cell');return {left,top,width:right-left+1,height:bottom-top+1};}
function region(a,box){return sharp(a.data,{raw:{width:a.width,height:a.height,channels:4}}).extract(box);}
async function save(a,box,name,w,h,fit='contain'){await region(a,box).resize(w,h,{fit,kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(output+name+'.png');return name;}
// ImageGen's character columns have deliberate outer margins: use measured cell separators.
const hero=await atlas('characters-walk'), heads=await atlas('character-heads');
for(let row=0;row<6;row++)for(let col=0;col<3;col++){
  const xs=[0,386,646,hero.width],ys=[0,256,512,768,1024,1280,hero.height];
  const box=bounds(hero,xs[col],ys[row],xs[col+1],ys[row+1]);
  const name=`character-${Math.floor(row/3)}-${['down','side','up'][row%3]}-${col}`;
  // Uniform height/foot anchor, no frame-dependent horizontal stretching.
  const scaled=await region(hero,box).resize({height:62,kernel:'nearest'}).png().toBuffer();
  const m=await sharp(scaled).metadata();
  await sharp({create:{width:48,height:64,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:scaled,left:Math.floor((48-m.width)/2),top:1}]).png().toFile(output+name+'.png');manifest.characters.push(name);
  const hx=[0,386,646,heads.width],hys=[0,262,506,745,985,1246,heads.height],hy=hys[row],he=hys[row+1];
  const hb=bounds(heads,hx[col],hy,hx[col+1],he);
  const hn=`head-${Math.floor(row/3)}-${row%3}-${['down','side','up'][col]}`;
  await save(heads,hb,hn,46,43);manifest.heads.push(hn);
}
const propNames=['oak','oak-round','pine','palm','bush-white','bush-pink','rocks','fence','bench','lamp','tent','fountain','boardgame','greenhouse','cafe','stall'];
const props=await atlas('environment-props');
for(let i=0;i<16;i++){const col=i%4,row=Math.floor(i/4),ys=[0,316,500,742,props.height],box=bounds(props,Math.floor(col*props.width/4),ys[row],Math.floor((col+1)*props.width/4),ys[row+1]);const name='prop-'+propNames[i];await save(props,box,name,192,192);manifest.props.push(name);}
const terrainNames=['grass','forest','soil','sand','stone','stone-alt','dirt','market','pond','pond-alt','ocean','ocean-alt','roof','wood','cliff','flowers'];
const terrain=await atlas('terrain-materials');
const terrainRows=[0,273,541,784,terrain.height];
for(let i=0;i<16;i++){const col=i%4,row=Math.floor(i/4);const box={left:Math.floor(col*terrain.width/4)+2,top:terrainRows[row]+2,width:Math.floor(terrain.width/4)-4,height:terrainRows[row+1]-terrainRows[row]-4};const name='tile-'+terrainNames[i];await save(terrain,box,name,96,96,'fill');manifest.terrain.push(name);}
async function optional(name,cols,rows,names,group,size=64){try{const a=await atlas(name);const ys=name==='wildlife'?[0,275,513,733,935,a.height]:name==='food-gear'?[0,290,514,777,a.height]:Array.from({length:rows+1},(_,i)=>Math.floor(i*a.height/rows));for(let i=0;i<names.length;i++){const col=i%cols,row=Math.floor(i/cols),box=bounds(a,Math.floor(col*a.width/cols),ys[row],Math.floor((col+1)*a.width/cols),ys[row+1]);await save(a,box,names[i],size,size);manifest[group].push(names[i]);}}catch(e){if(e.code==='ENOENT')return;throw e;}}
await optional('wildlife',4,5,['cat','rabbit','butterfly','bee','ladybug'].flatMap(k=>Array.from({length:4},(_,i)=>'animal-'+k+'-'+i)),'wildlife');
await optional('inventory',4,6,['carp','goldfish','koi','bluegill','mackerel','clownfish','seahorse','butterfly','beetle','firefly','mushroom','snow-rabbit','animal-friend','carrot','tomato','wheat','shell','pearl','treasure','cleanup','chef','musician','voyager','camper'].map(k=>'icon-'+k),'icons');
await optional('food-gear',4,4,['salad','soup','cafe-order','cafe-prepare','cafe-cook','cafe-serve','camp-hat','straw-hat','fisher-hat','chef-hat','cat-hat','cafe-apron','coin','music','speaker','card-back'].map(k=>'icon-'+k),'icons');
const ui=await atlas('ui-kit'),uiNames=['parchment','green','title','gold','blue','leaf','red','balance','slot','minimap','portrait','table'];
const uiBoxes=[[0,100,380,300],[380,100,370,300],[750,185,415,165],[1165,185,371,165],[0,405,384,160],[384,405,384,160],[768,405,376,160],[1144,405,392,160],[0,575,305,350],[305,575,440,350],[745,575,320,350],[1065,575,471,365]];
for(let i=0;i<12;i++){const [x,y,w,h]=uiBoxes[i],box=bounds(ui,x,y,x+w,y+h),name='ui-'+uiNames[i];await region(ui,box).resize({width:512,kernel:'nearest'}).png().toFile(output+name+'.png');manifest.ui.push(name);}
// The creator courtyard is assembled from the SAME production terrain/props, not a mismatched painting.
const layers=[];
for(let y=0;y<384;y+=96)for(let x=0;x<512;x+=96)layers.push({input:await sharp(output+'tile-grass.png').resize(Math.min(96,512-x),Math.min(96,384-y),{kernel:'nearest'}).png().toBuffer(),left:x,top:y});
for(let y=0;y<384;y+=96)for(let x=160;x<352;x+=96)layers.push({input:output+'tile-stone.png',left:x,top:y});
layers.push({input:await sharp(output+'prop-boardgame.png').resize(220,220,{kernel:'nearest'}).png().toBuffer(),left:146,top:0});
for(const [left,top]of [[0,0],[370,0],[0,125],[370,125]])layers.push({input:await sharp(output+'prop-oak.png').resize(142,150,{kernel:'nearest'}).png().toBuffer(),left,top});
for(const [left,top]of [[100,220],[342,220],[50,310],[405,310]])layers.push({input:await sharp(output+'prop-bush-pink.png').resize(58,58,{kernel:'nearest'}).png().toBuffer(),left,top});
await sharp({create:{width:512,height:384,channels:4,background:'#69a94a'}}).composite(layers).png().toFile(output+'creator-courtyard.png');
for(const name of ['cafe-interior','inn-interior'])await sharp(source+name+'-source.png').resize(960,640,{kernel:'nearest'}).png().toFile(output+name+'.png');
await writeFile(output+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Exported',Object.values(manifest).filter(Array.isArray).flat().length,'reference assets');
