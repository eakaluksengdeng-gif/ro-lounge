import { renderCharacterCanvas, type Dir } from "../art";
import type { Appearance } from "../net";
import { appearanceToLook, loadAppearance, OPTION_COUNTS } from "./appearance";
import "./creator.css";

type Part = keyof Appearance;
const GROUPS: { key: Part; label: string; names: string[]; crop: [number, number, number, number] }[] = [
  { key: "style", label: "ทรงผม", names: ["ผมสั้น", "ผมยาว", "มวยผม"], crop: [2, 0, 14, 13] },
  { key: "hair", label: "สีผม", names: ["น้ำตาลเข้ม", "น้ำตาล", "ทอง", "แดง", "ดำอมม่วง", "ม่วง"], crop: [2, 0, 14, 13] },
  { key: "color", label: "เสื้อ", names: ["ชมพู", "เหลือง", "เขียว", "ฟ้า", "น้ำเงิน", "ม่วง", "ชมพูอ่อน"], crop: [2, 11, 14, 8] },
  { key: "skin", label: "สีผิว", names: ["สว่าง", "กลาง", "เข้ม"], crop: [2, 0, 14, 13] },
  { key: "pants", label: "กางเกง", names: ["กรมท่า", "เทาม่วง", "น้ำตาล"], crop: [3, 17, 11, 7] },
];

/** Visual, keyboard-accessible appearance picker; no network connection needed to use it. */
export class CharacterCreator {
  private look = loadAppearance();
  private dir: Dir = "down";
  private flipped = false;
  private direction = 0;
  private preview = document.createElement("canvas");
  private label = document.createElement("p");
  private choices: { canvas: HTMLCanvasElement; key: Part; index: number; crop: [number, number, number, number]; input: HTMLInputElement }[] = [];

  constructor(root: HTMLElement, private name: HTMLInputElement) {
    const stage = document.createElement("section");
    stage.className = "creator-preview";
    stage.setAttribute("aria-label", "ตัวอย่างตัวละคร");
    const caption = document.createElement("span");
    caption.className = "creator-caption";
    caption.textContent = "CHARACTER PREVIEW";
    const scenery = document.createElement("div");
    scenery.className = "creator-scenery";
    this.preview.id = "characterPreview";
    this.preview.width = 18;
    this.preview.height = 24;
    this.preview.setAttribute("role", "img");
    scenery.append(this.preview);
    this.label.id = "characterPreviewName";
    const turn = document.createElement("div");
    turn.className = "creator-turn";
    const button = (text: string, title: string, step: number) => {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = text;
      el.setAttribute("aria-label", title);
      el.addEventListener("click", () => {
        this.direction = (this.direction + step + 4) % 4;
        this.dir = (["down", "side", "up", "side"] as Dir[])[this.direction];
        this.flipped = this.direction === 3;
        this.drawPreview();
      });
      return el;
    };
    const hint = document.createElement("span");
    hint.textContent = "หมุนดูตัวละคร";
    turn.append(button("◀", "หมุนตัวละครไปทางซ้าย", -1), hint, button("▶", "หมุนตัวละครไปทางขวา", 1));
    const info = document.createElement("p");
    info.className = "creator-note";
    info.textContent = "เลือกภาพด้านขวา แล้วดูตัวจริงได้ทันที";
    stage.append(caption, scenery, this.label, turn, info);
    const options = document.createElement("section");
    options.className = "creator-options";
    options.setAttribute("aria-label", "เลือกหน้าตาตัวละคร");
    for (const group of GROUPS) {
      const fieldset = document.createElement("fieldset");
      fieldset.dataset.part = group.key;
      const legend = document.createElement("legend");
      legend.textContent = group.label;
      const list = document.createElement("div");
      list.className = "creator-choices";
      for (let index = 0; index < OPTION_COUNTS[group.key]; index++) {
        const tile = document.createElement("label");
        tile.className = "creator-tile";
        tile.title = group.label + " · " + group.names[index];
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "appearance-" + group.key;
        input.value = String(index);
        input.checked = this.look[group.key] === index;
        input.setAttribute("aria-label", group.label + " " + group.names[index]);
        input.addEventListener("change", () => {
          if (!input.checked) return;
          this.look[group.key] = index;
          // Remember before joining, so a refresh doesn't discard visual selections.
          try { localStorage.setItem("ro-look", JSON.stringify(this.look)); } catch { /* ignore */ }
          this.redraw();
        });
        const card = document.createElement("span");
        card.className = "creator-card";
        const canvas = document.createElement("canvas");
        canvas.width = group.crop[2] * 4;
        canvas.height = group.crop[3] * 4;
        canvas.setAttribute("aria-hidden", "true");
        const tick = document.createElement("span");
        tick.className = "creator-tick";
        tick.textContent = "✓";
        tick.setAttribute("aria-hidden", "true");
        card.append(canvas, tick);
        tile.append(input, card);
        list.append(tile);
        this.choices.push({ canvas, key: group.key, index, crop: group.crop, input });
      }
      fieldset.append(legend, list);
      options.append(fieldset);
    }
    root.replaceChildren(stage, options);
    this.name.addEventListener("input", () => this.drawPreview());
    this.redraw();
  }

  selectedLook(): Appearance { return { ...this.look }; }

  private drawPreview() {
    const context = this.preview.getContext("2d")!;
    const sprite = renderCharacterCanvas(appearanceToLook(this.look), this.dir);
    context.clearRect(0, 0, 18, 24);
    context.save();
    if (this.flipped) { context.translate(18, 0); context.scale(-1, 1); }
    context.drawImage(sprite, 0, 0);
    context.restore();
    this.label.textContent = this.name.value.trim() || "Novice";
    this.preview.setAttribute("aria-label", "ตัวอย่าง " + this.label.textContent);
    this.preview.dataset.look = JSON.stringify(this.look);
    this.preview.dataset.direction = String(this.direction);
  }

  private redraw() {
    this.drawPreview();
    for (const choice of this.choices) {
      const sprite = renderCharacterCanvas(appearanceToLook({ ...this.look, [choice.key]: choice.index }));
      const ctx = choice.canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, choice.canvas.width, choice.canvas.height);
      ctx.drawImage(sprite, ...choice.crop, 0, 0, choice.canvas.width, choice.canvas.height);
      choice.input.checked = this.look[choice.key] === choice.index;
    }
  }
}
