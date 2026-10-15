/** The same decoded raster assets are shared by Phaser, previews and DOM interfaces. */
const images=new Map<string,HTMLImageElement>();
let ready:Promise<void>|undefined;
export const ART_VERSION='reference-v1';
export function artImage(key:string){const image=images.get(key);if(!image)throw new Error('Reference art not loaded: '+key);return image;}
export function loadReferenceArt(){
  return ready??= (async()=>{
    for(const directory of ['reference-v1','activity-v2']){
      const response=await fetch('/art/'+directory+'/manifest.json');
      if(!response.ok)throw new Error('โหลดชุดภาพเกมไม่สำเร็จ');
      const manifest=await response.json();
      await Promise.all(Object.values(manifest).filter(Array.isArray).flat().map(async(key:any)=>{
        const image=new Image();image.src='/art/'+directory+'/'+key+'.png';await image.decode();images.set(key,image);
      }));
    }
    document.documentElement.dataset.artVersion=ART_VERSION;
    document.documentElement.dataset.activityArtVersion='activity-v2';
  })();
}
export function artCanvas(key:string,w=64,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false;ctx.drawImage(artImage(key),0,0,w,h);return c;}
