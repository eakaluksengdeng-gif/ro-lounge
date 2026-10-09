import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { PlayerState } from "../net";
import type { WildlifeView, WeatherKind } from "../../../shared/nature";
import { FISHING_SPOTS } from "../../../shared/nature";
import { MAP_H, POND, TILE_PX } from "../world";
import { buildNatureTextures } from "./art";

interface AnimalSprite { body: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse }
interface Particle { x: number; y: number; speed: number; drift: number }
export class TownNature {
  private animals = new Map<string, AnimalSprite>();
  private rods: Phaser.GameObjects.Graphics;
  private effects: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  private weather: WeatherKind = "sunny";
  private spawnWidth = 0;
  constructor(private scene: Phaser.Scene, private room: Room<any>) {
    buildNatureTextures(scene);
    this.rods = scene.add.graphics();
    this.effects = scene.add.graphics().setScrollFactor(0).setDepth(MAP_H + 2000);
    for (const [index, spot] of FISHING_SPOTS.entries()) {
      const g = scene.add.graphics().setDepth(spot.y - 5);
      if (index === 0) {
        g.fillStyle(0x67472f).fillRect(spot.x - 35, spot.y - 30, 48, 60);
        for (let row = -27; row < 30; row += 9) g.fillStyle(0xc19159).fillRect(spot.x - 32, spot.y + row, 42, 6);
      }
      const x = spot.x + (index === 0 ? 34 : 40);
      g.fillStyle(0x754c37).fillRect(x - 3, spot.y - 45, 6, 45);
      g.fillStyle(0xe5c992).fillRect(x - 24, spot.y - 54, 48, 27);
      scene.add.text(x, spot.y - 42, "🐟", { fontSize: "20px" }).setOrigin(.5).setDepth(spot.y + 1);
      scene.add.text(spot.x, spot.y + 38, "ตกได้รอบบ่อ · SPACE", {
        fontFamily: '"Noto Sans Thai", sans-serif', fontSize: "12px", color: "#fff0c8",
        backgroundColor: "#233649b8", padding: { x: 5, y: 3 },
      }).setOrigin(.5).setDepth(spot.y + 42);
    }
  }
  update(t: number, dtMs: number) {
    const seen = new Set<string>();
    this.room.state?.wildlife?.forEach((animal: WildlifeView, id: string) => {
      seen.add(id);
      let view = this.animals.get(id);
      if (!view) {
        const feet = animal.kind === "cat" ? 19 : animal.kind === "rabbit" ? 20 : animal.kind === "ladybug" ? 18 : 16;
        const shadow = this.scene.add.ellipse(0, -2, animal.kind === "cat" ? 28 : 18, 6, 0x17242a, .2);
        const sprite = this.scene.add.image(0, 0, `nature-${animal.kind}-${animal.variant}-0`)
          .setOrigin(.5, feet / 22).setScale(animal.kind === "cat" ? 3 : 2);
        const body = this.scene.add.container(animal.x, animal.y, [shadow, sprite]);
        view = { body, sprite, shadow }; this.animals.set(id, view);
      }
      const k = 1 - Math.pow(.001, dtMs / 1000);
      view.body.x += (animal.x - view.body.x) * k;
      view.body.y += (animal.y - view.body.y) * k;
      view.body.setDepth(view.body.y);
      const flying = animal.kind === "bee" || animal.kind === "butterfly";
      const frame = Math.floor(t / (flying ? 160 : 240)) % 2;
      view.sprite.setTexture(`nature-${animal.kind}-${animal.variant}-${animal.moving || flying ? frame : 0}`);
      view.sprite.setFlipX(animal.facing < 0);
      view.sprite.y = flying ? -16 + Math.sin(t / 260 + animal.variant) * 4
        : animal.kind === "rabbit" && animal.moving ? -Math.abs(Math.sin(t / 160)) * 7 : 0;
      view.shadow.setAlpha(flying ? .09 : .2);
    });
    for (const [id, view] of this.animals) if (!seen.has(id)) { view.body.destroy(); this.animals.delete(id); }
    this.drawFishing(t);
    this.weather = this.room.state?.weather ?? "sunny";
    this.drawWeather(t, dtMs);
  }
  private drawFishing(t: number) {
    this.rods.clear().setDepth(MAP_H + 50);
    this.room.state?.players?.forEach((p: PlayerState) => {
      if (!p.fishing) return;
      const dx = p.fishingBobberX - p.x, dy = p.fishingBobberY - p.y;
      const distance = Math.hypot(dx, dy) || 1;
      const dirX = dx / distance, dirY = dy / distance;
      const x = p.x + dirX * 12, y = p.y - 25;
      const tipX = x + dirX * 30, tipY = y - 30 + dirY * 12;
      this.rods.lineStyle(3, 0x8c6042, 1).lineBetween(x, y, tipX, tipY);
      const bobY = p.fishingBobberY + Math.sin(t / (p.fishing === "bite" ? 75 : 600)) * (p.fishing === "bite" ? 5 : 2);
      this.rods.lineStyle(1, 0xf6f0d0, .85).lineBetween(tipX, tipY, p.fishingBobberX, bobY);
      this.rods.lineStyle(2, 0xc5edff, .7).strokeEllipse(p.fishingBobberX, bobY + 4, p.fishing === "bite" ? 28 : 13, 7);
      this.rods.fillStyle(0xffffff).fillRect(p.fishingBobberX - 3, bobY - 4, 6, 5);
      this.rods.fillStyle(0xef7d80).fillRect(p.fishingBobberX - 3, bobY + 1, 6, 4);
      if (p.fishing === "bite") {
        this.rods.fillStyle(0xffdf7e).fillRect(p.x - 3, p.y - 104, 6, 16).fillRect(p.x - 3, p.y - 83, 6, 6);
      }
    });
  }
  private drawWeather(t: number, dtMs: number) {
    const { width, height } = this.scene.scale;
    this.effects.clear();
    if (this.spawnWidth !== width || !this.particles.length) {
      this.spawnWidth = width;
      this.particles = Array.from({ length: width < 680 ? 55 : 95 }, () => ({
        x: Math.random() * width, y: Math.random() * height, speed: 140 + Math.random() * 220, drift: Math.random() * 6,
      }));
    }
    if (this.weather === "sunny") {
      this.effects.fillStyle(0xffdc8c, .045).fillRect(0, 0, width, height);
      this.effects.fillStyle(0xfff1b2, .07).fillTriangle(width * .15, 0, width * .38, 0, width * .65, height);
      return;
    }
    const rain = this.weather === "rain";
    this.effects.fillStyle(rain ? 0x223b62 : 0xe1f1ff, rain ? .13 : .09).fillRect(0, 0, width, height);
    const dt = Math.min(dtMs, 80) / 1000;
    for (const particle of this.particles) {
      particle.y += particle.speed * dt * (rain ? 1.6 : .2);
      particle.x += rain ? -100 * dt : Math.sin(t / 1000 + particle.drift) * 18 * dt;
      if (particle.y > height + 20) { particle.y = -20; particle.x = Math.random() * width; }
      if (particle.x < -20) particle.x = width + 10;
      if (particle.x > width + 20) particle.x = -10;
      if (rain) this.effects.lineStyle(1.5, 0xc9e5f5, .5).lineBetween(particle.x, particle.y, particle.x - 4, particle.y + 15);
      else this.effects.fillStyle(0xffffff, .75).fillRect(Math.round(particle.x), Math.round(particle.y), 3, 3);
    }
    // Rain also makes little ripples on the pond, in world coordinates converted to screen.
    if (rain) for (let i = 0; i < 5; i++) {
      const cycle = (t / 800 + i * .2) % 1;
      const x = POND.cx * TILE_PX + Math.cos(i * 2.4) * 110 - this.scene.cameras.main.scrollX;
      const y = POND.cy * TILE_PX + Math.sin(i * 2.4) * 60 - this.scene.cameras.main.scrollY;
      this.effects.lineStyle(1, 0xd2edff, (1 - cycle) * .5).strokeEllipse(x, y, 6 + cycle * 24, 3 + cycle * 8);
    }
  }
}
