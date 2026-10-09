/** Keep subpixel simulation positions; roundPixels handles crisp rendering separately. */
export function avatarMotion(current: { x: number; y: number }, player: { x: number; y: number; targetX: number; targetY: number }, dtMs: number) {
  const k = 1 - Math.pow(.001, Math.max(0, dtMs) / 1000);
  const x = current.x + (player.x - current.x) * k;
  const y = current.y + (player.y - current.y) * k;
  const dx = x - current.x, dy = y - current.y;
  const distance = Math.hypot(dx, dy);
  return { x, y, dx, dy, distance, walking: Math.hypot(player.targetX - player.x, player.targetY - player.y) > 1 && distance > .12 };
}
