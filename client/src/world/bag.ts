/** Small code-native pixel icon, sharing the existing warm wood/leaf palette. */
export function bagCanvas(){
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.setAttribute('aria-hidden','true');const c=canvas.getContext('2d')!;
 c.fillStyle='#483227';c.fillRect(10,2,12,4);c.fillRect(7,6,18,2);c.fillRect(5,9,22,19);c.fillRect(7,28,18,2);
 c.fillStyle='#b27438';c.fillRect(7,11,18,16);c.fillStyle='#e5b86a';c.fillRect(8,9,16,15);c.fillRect(9,24,14,3);
 c.fillStyle='#5b8050';c.fillRect(8,7,16,7);c.fillRect(10,14,12,2);c.fillStyle='#a7c47c';c.fillRect(9,8,14,2);
 c.fillStyle='#583b26';c.fillRect(14,12,4,7);c.fillStyle='#ffe7a0';c.fillRect(15,14,2,3);
 c.fillStyle='#f7d897';c.fillRect(10,21,12,2);return canvas;
}
