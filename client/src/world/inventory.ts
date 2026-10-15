import {ITEMS,type Progress} from '../../../shared/regions';
import {FISH_SPECIES} from '../../../shared/nature';
/** Activity records are historical achievements/tokens, never physical bag stacks. */
export const RECORD_ITEMS=new Set(['snow-rabbit','animal-friend','cleanup','chef','musician','voyager','camper']);
export interface CatalogueEntry {id:string;name:string;category:string;count:number;found:boolean;record:boolean;}
export function catalogue(progress:Progress,fish:Record<string,number>,fishDiscovered:readonly string[]=[]):CatalogueEntry[]{
 return [...Object.entries(ITEMS).map(([id,item])=>({id,name:item.name,category:item.category,count:progress.inventory[id]??0,found:progress.discovered.includes(id)||(progress.inventory[id]??0)>0,record:RECORD_ITEMS.has(id)})),
 ...FISH_SPECIES.map(f=>({id:f.id,name:f.name,category:'ปลา',count:fish[f.id]??0,found:(fish[f.id]??0)>0||progress.discovered.includes(f.id)||fishDiscovered.includes(f.id),record:false}))];
}
export function bagEntries(progress:Progress,fish:Record<string,number>){return catalogue(progress,fish).filter(entry=>!entry.record&&entry.count>0);}
export function bagQuantity(progress:Progress,fish:Record<string,number>){return bagEntries(progress,fish).reduce((sum,entry)=>sum+entry.count,0);}
