import type {Crop} from './regions';
/** Four visible stages, using the server clock. Unwatered crops never display ripe. */
export function growthStage(crop:Crop,now:number):0|1|2|3{
 const progress=Math.max(0,(now-crop.plantedAt)/Math.max(1,crop.readyAt-crop.plantedAt));
 return Math.min(crop.watered?3:2,progress>=1?3:Math.floor(progress*3)) as 0|1|2|3;
}
