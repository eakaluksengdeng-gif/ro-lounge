import type { AnimalKind, WeatherKind, WildlifeView } from "../../../shared/nature";
import { isBlocked } from "../world";

interface Wanderer extends WildlifeView { homeX: number; homeY: number; tx: number; ty: number; pauseUntil: number }
const HOMES: [AnimalKind, number, number][] = [
  ["cat", 530, 530], ["cat", 870, 530], ["cat", 1120, 660],
  ["rabbit", 440, 490], ["rabbit", 390, 760], ["rabbit", 1110, 220],
  ["butterfly", 430, 460], ["butterfly", 1200, 610], ["butterfly", 230, 300],
  ["bee", 520, 240], ["bee", 1220, 400], ["ladybug", 460, 710], ["ladybug", 1100, 720],
];
export class EnvironmentManager {
  readonly animals = new Map<string, Wanderer>();
  constructor(readonly epoch = Date.now(), readonly phaseMs = 120_000, private random = Math.random) {
    if (!Number.isSafeInteger(phaseMs) || phaseMs < 1000) throw new Error("Invalid weather phase duration");
    HOMES.forEach(([kind, x, y], index) => this.animals.set("wild-" + index, {
      kind, variant: index % 3, x, y, homeX: x, homeY: y, tx: x, ty: y,
      facing: 1, moving: false, pauseUntil: epoch + index * 160,
    }));
  }
  weather(now: number): { kind: WeatherKind; nextChangeAt: number; serverTime: number } {
    const index = Math.max(0, Math.floor((now - this.epoch) / this.phaseMs));
    return { kind: (["sunny", "rain", "snow"] as WeatherKind[])[index % 3],
      nextChangeAt: this.epoch + (index + 1) * this.phaseMs, serverTime: now };
  }
  update(now: number, dtMs: number): void {
    const dt = Math.min(dtMs, 200) / 1000;
    for (const animal of this.animals.values()) {
      if (now < animal.pauseUntil) { animal.moving = false; continue; }
      const flying = animal.kind === "bee" || animal.kind === "butterfly";
      const dx = animal.tx - animal.x, dy = animal.ty - animal.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 3) {
        animal.moving = false;
        animal.pauseUntil = now + (flying ? 300 : 1000) + this.random() * 2800;
        for (let tries = 0; tries < 16; tries++) {
          const angle = this.random() * Math.PI * 2;
          const radius = 20 + this.random() * (flying ? 100 : 70);
          const x = animal.homeX + Math.cos(angle) * radius;
          const y = animal.homeY + Math.sin(angle) * radius;
          if (x > 40 && x < 1400 && y > 90 && y < 830 && !isBlocked(x, y)) { animal.tx = x; animal.ty = y; break; }
        }
        continue;
      }
      const speed = animal.kind === "rabbit" ? 44 : animal.kind === "cat" ? 30 : animal.kind === "ladybug" ? 13 : 28;
      const step = Math.min(distance, speed * dt);
      const x = animal.x + dx / distance * step, y = animal.y + dy / distance * step;
      if (isBlocked(x, y)) { animal.tx = animal.x; animal.ty = animal.y; animal.moving = false; continue; }
      animal.x = x; animal.y = y; animal.facing = dx < 0 ? -1 : 1; animal.moving = true;
    }
  }
}
