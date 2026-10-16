import {GAME_ORIGIN,LEGACY_ORIGIN} from '../brand';
const KEYS=['ro-guest-session','ro-name','ro-look','ro-sound-muted','ro-music-muted','ro-music-volume'] as const;
export const TRANSFER_TYPES={request:'clover:request',ready:'clover:ready',data:'clover:data',ack:'clover:received'} as const;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function snapshot(){const data:Record<string,string>={};for(const key of KEYS){const value=localStorage.getItem(key);if(value!==null)data[key]=value;}return data;}
export function cleanTransfer(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('ข้อมูลย้ายตัวละครไม่ถูกต้อง');
 const input=raw as Record<string,unknown>;if(!uuid(input['ro-guest-session']))throw new Error('ไม่พบตัวละครเดิมในเบราว์เซอร์นี้');
 const data:Record<string,string>={'ro-guest-session':input['ro-guest-session']};
 for(const key of KEYS.slice(1)){const value=input[key];if(typeof value!=='string')continue;
  if(key==='ro-name'&&value.length<=80)data[key]=value;
  if(key==='ro-look'&&value.length<=2048){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))data[key]=value;}catch{/* Appearance can fall back without losing the player. */}}
  if((key==='ro-sound-muted'||key==='ro-music-muted')&&['true','false'].includes(value))data[key]=value;
  if(key==='ro-music-volume'&&value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1)data[key]=value;
 }return data;
}
/** Never silently replace a different character; keep a recoverable local backup. */
export function importTransfer(raw:unknown,approve:()=>boolean){
 const next=cleanTransfer(raw),before=snapshot();if(before['ro-guest-session']===next['ro-guest-session'])return false;
 if(before['ro-guest-session']&&!approve())throw new Error('ยกเลิกการเปลี่ยนตัวละครแล้ว');
 if(before['ro-guest-session'])localStorage.setItem('clover-nook.session-backup',JSON.stringify(before));
 try{for(const key of KEYS){if(key in next)localStorage.setItem(key,next[key]);else localStorage.removeItem(key);}}
 catch{for(const key of KEYS){try{if(key in before)localStorage.setItem(key,before[key]);else localStorage.removeItem(key);}catch{/* Original credentials remain on the old site. */}}throw new Error('เบราว์เซอร์ไม่อนุญาตให้บันทึก กรุณาเล่นบนเว็บเดิมต่อก่อน');}
 return true;
}
export function installVillageMigration(form:HTMLElement){
 const origin=location.origin;if(origin!==GAME_ORIGIN&&origin!==LEGACY_ORIGIN)return;
 const panel=document.createElement('section');panel.className='village-migration';const label=document.createElement('p'),button=document.createElement('button'),status=document.createElement('p');status.setAttribute('role','status');button.type='button';button.id='villageMigrationButton';
 let peer:Window|null=null,nonce='';
 if(origin===LEGACY_ORIGIN){
  label.textContent='บ้านของเราชื่อ Clover Nook แล้ว · ลิงก์เก่ายังเล่นต่อได้';button.textContent='ย้ายไปบ้านใหม่ พร้อมตัวละครเดิม';
  button.onclick=()=>{peer=window.open(GAME_ORIGIN,'clover-nook-move');status.textContent=peer?'กำลังเปิดบ้านใหม่…':'อนุญาตป๊อปอัปเพื่อย้ายตัวละคร';};
  window.addEventListener('message',event=>{if(event.origin!==GAME_ORIGIN||!peer||event.source!==peer||event.data?.type!==TRANSFER_TYPES.request||!uuid(event.data.nonce))return;
   try{peer.postMessage({type:TRANSFER_TYPES.data,nonce:event.data.nonce,payload:cleanTransfer(snapshot())},GAME_ORIGIN);status.textContent='ส่งตัวละครเดิมแล้ว · ของและชิปอยู่ที่เซิร์ฟเวอร์เดิม';}catch(error){status.textContent=error instanceof Error?error.message:'ย้ายไม่สำเร็จ';}
  });
 }else{
  label.textContent='เคยเล่นที่เว็บเดิม? ใช้ตัวละคร ของ และชิปเดิมได้';button.textContent='ย้ายตัวละครจากเว็บเดิม';
  const request=()=>peer?.postMessage({type:TRANSFER_TYPES.request,nonce},LEGACY_ORIGIN);
  button.onclick=()=>{nonce=crypto.randomUUID();peer=window.open(LEGACY_ORIGIN+'/move-player.html','clover-nook-recover');status.textContent=peer?'กดยืนยันในหน้าต่างเว็บเดิมเพื่อย้ายตัวละคร':'อนุญาตป๊อปอัปเพื่อย้ายตัวละคร';};
  window.addEventListener('message',event=>{
   if(event.origin!==LEGACY_ORIGIN||!peer||event.source!==peer||!event.data)return;
   if(event.data.type===TRANSFER_TYPES.ready){request();return;}
   if(event.data.type!==TRANSFER_TYPES.data||event.data.nonce!==nonce)return;
   try{const changed=importTransfer(event.data.payload,()=>window.confirm('มีตัวละครอีกตัวบนเว็บใหม่นี้อยู่แล้ว ต้องการเปลี่ยนมาใช้ตัวละครจากเว็บเดิมไหม? ตัวปัจจุบันจะสำรองไว้ในเบราว์เซอร์นี้'));
    peer.postMessage({type:TRANSFER_TYPES.ack,nonce},LEGACY_ORIGIN);status.textContent='ตัวละครเดิมพร้อมแล้ว กดเข้าเมืองได้เลย';if(changed)location.reload();
   }catch(error){status.textContent=error instanceof Error?error.message:'ย้ายไม่สำเร็จ กรุณาเล่นเว็บเดิมต่อก่อน';}
  });
  // The old site's user-clicked move button opens this window with an opener.
  if(window.opener){peer=window.opener;nonce=crypto.randomUUID();request();}
 }
 panel.append(label,button,status);form.querySelector('header')?.after(panel);
}

/** This provider is ONLY for the old origin, in a user-opened top-level popup. */
export function installTransferProvider(button:HTMLButtonElement,status:HTMLElement){
 button.disabled=true;if(location.origin!==LEGACY_ORIGIN||!window.opener||window.parent!==window){status.textContent='เปิดหน้านี้จากปุ่มย้ายตัวละครใน Clover Nook เท่านั้น';return;}
 let nonce='';const peer=window.opener as Window;
 window.addEventListener('message',event=>{
  if(event.origin!==GAME_ORIGIN||event.source!==peer)return;
  if(event.data?.type===TRANSFER_TYPES.request&&uuid(event.data.nonce)){nonce=event.data.nonce;button.disabled=false;status.textContent='พร้อมย้ายตัวละครจากเบราว์เซอร์นี้ โดยเว็บเดิมยังเก็บข้อมูลไว้';}
  if(event.data?.type===TRANSFER_TYPES.ack&&event.data.nonce===nonce){status.textContent='ย้ายสำเร็จแล้ว กลับไปที่หน้าต่าง Clover Nook ได้เลย';button.disabled=true;}
 });
 button.onclick=()=>{if(!nonce)return;try{peer.postMessage({type:TRANSFER_TYPES.data,nonce,payload:cleanTransfer(snapshot())},GAME_ORIGIN);status.textContent='ส่งแล้ว กำลังรอการยืนยันจากบ้านใหม่…';}catch(error){status.textContent=error instanceof Error?error.message:'อ่านข้อมูลเดิมไม่ได้';}};
 peer.postMessage({type:TRANSFER_TYPES.ready},GAME_ORIGIN);
}
