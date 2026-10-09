import Phaser from "phaser";
import type { AnimalKind } from "../../../shared/nature";

/** Small original code-native sprites, matching the town's existing 3x pixel art. */
export function buildNatureTextures(scene: Phaser.Scene) {
  const kinds: AnimalKind[] = ["cat", "rabbit", "butterfly", "bee", "ladybug"];
  for (const kind of kinds) for (let variant = 0; variant < 3; variant++) for (let frame = 0; frame < 2; frame++) {
    const key = `nature-${kind}-${variant}-${frame}`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 22, 22)!;
    const c = tex.getContext();
    const rect = (color: string, x: number, y: number, w = 1, h = 1) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    const ink = "#493c49";
    if (kind === "cat") {
      const coat = ["#eab070", "#eee4cb", "#8d929e"][variant];
      rect(ink, 2, 8, 15, 9); rect(coat, 3, 9, 13, 7);
      rect(ink, 13, 5, 7, 10); rect(coat, 14, 6, 5, 8);
      rect(ink, 13, 3, 2, 3); rect(ink, 18, 3, 2, 3);
      rect("#efb1af", 14, 4, 1, 2); rect("#efb1af", 18, 4, 1, 2);
      rect("#fff2d9", 16, 11, 3, 3); rect(ink, 16, 8); rect(ink, 19, 8);
      rect("#c9767b", 18, 11); rect("#bb7d58", 8, 9, 2, 3); rect("#bb7d58", 11, 9, 2, 2);
      rect(ink, 4 + frame, 16, 3, 3); rect(ink, 12 - frame, 16, 3, 3);
      rect(coat, 4 + frame, 16, 2, 2); rect(coat, 12 - frame, 16, 2, 2);
      rect(ink, 0, 5 + frame, 3, 6); rect(coat, 1, 5 + frame, 1, 5);
    } else if (kind === "rabbit") {
      const coat = ["#fff1da", "#d7d9e1", "#e9caaa"][variant];
      rect(ink, 4, 10, 13, 9); rect(coat, 5, 11, 11, 7);
      rect(ink, 12, 6, 8, 10); rect(coat, 13, 7, 6, 8);
      rect(ink, 12, 0, 3, 7); rect(ink, 17, frame, 3, 7);
      rect(coat, 13, 1, 1, 6); rect(coat, 18, frame + 1, 1, 6);
      rect("#f3b0b7", 13, 2, 1, 4); rect("#f3b0b7", 18, frame + 2, 1, 4);
      rect(ink, 17, 10); rect("#ec9ea8", 19, 12);
      rect(coat, 2, 13, 3, 3); rect(coat, 6, 18, 4, 2); rect(coat, 15, 17, 5, 2);
    } else if (kind === "butterfly") {
      const wing = ["#cb94f3", "#ffb487", "#7fd3ef"][variant];
      rect(ink, 10, 8, 2, 6); rect(ink, 9, 6); rect(ink, 12, 6);
      if (frame === 0) {
        rect(wing, 5, 7, 5, 5); rect(wing, 12, 7, 5, 5);
        rect(wing, 7, 12, 3, 3); rect(wing, 12, 12, 3, 3);
        rect("#fff3c2", 6, 8, 2, 2); rect("#fff3c2", 14, 8, 2, 2);
      } else { rect(wing, 8, 6, 2, 8); rect(wing, 12, 6, 2, 8); }
    } else if (kind === "bee") {
      rect("#d8f3fa", 8, 5 + frame, 3, 4); rect("#d8f3fa", 12, 4 + frame, 3, 4);
      rect(ink, 6, 9, 11, 6); rect("#ffd16b", 7, 10, 9, 4);
      rect(ink, 9, 10, 1, 4); rect(ink, 12, 10, 1, 4); rect(ink, 15, 11);
    } else {
      rect(ink, 7, 11, 8, 7); rect("#ee7f80", 8, 11, 6, 6);
      rect(ink, 11, 11, 1, 6); rect(ink, 9, 13); rect(ink, 13, 15);
      rect(ink, 14, 12, 3, 3);
    }
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST); tex.refresh();
  }
}
