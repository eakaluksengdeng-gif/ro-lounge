import Phaser from "phaser";
import { joinTown, type Appearance, type ChatMsg } from "./net";
import { TownScene } from "./scenes/TownScene";
import { CasinoUI } from "./pokdeng/CasinoUI";
import { forgetGuest } from "./pokdeng/guest";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const login = $("login");
const loginForm = $<HTMLFormElement>("loginForm");
const nameInput = $<HTMLInputElement>("nameInput");
const shirtColors = $("shirtColors");
const hairColor = $<HTMLSelectElement>("hairColor");
const hairStyle = $<HTMLSelectElement>("hairStyle");
const skinTone = $<HTMLSelectElement>("skinTone");
const pantsColor = $<HTMLSelectElement>("pantsColor");
const hud = $("hud");
const logEl = $("log");
const chatForm = $<HTMLFormElement>("chatForm");
const chatInput = $<HTMLInputElement>("chatInput");
const emotesEl = $("emotes");
const statusEl = $("status");
const setStatus = (t: string) => {
  statusEl.textContent = t;
  statusEl.style.display = t ? "block" : "none";
};

const SHIRT_COLORS = ["#f28b82", "#fbbc04", "#a7d676", "#78d9ec", "#aecbfa", "#d7aefb", "#fdcfe8"];
const DEFAULT_LOOK: Appearance = { color: 3, hair: 0, skin: 0, pants: 0, style: 0 };

function safeIndex(raw: unknown, count: number, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < count ? n : fallback;
}

function loadLook(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem("ro-look") ?? "null") as Partial<Appearance> | null;
    if (!saved) return DEFAULT_LOOK;
    return {
      color: safeIndex(saved.color, SHIRT_COLORS.length, DEFAULT_LOOK.color),
      hair: safeIndex(saved.hair, 6, DEFAULT_LOOK.hair),
      skin: safeIndex(saved.skin, 3, DEFAULT_LOOK.skin),
      pants: safeIndex(saved.pants, 3, DEFAULT_LOOK.pants),
      style: safeIndex(saved.style, 3, DEFAULT_LOOK.style),
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

function selectedLook(): Appearance {
  const checked = shirtColors.querySelector<HTMLInputElement>('input[name="shirtColor"]:checked');
  return {
    color: safeIndex(checked?.value, SHIRT_COLORS.length, DEFAULT_LOOK.color),
    hair: safeIndex(hairColor.value, 6, DEFAULT_LOOK.hair),
    skin: safeIndex(skinTone.value, 3, DEFAULT_LOOK.skin),
    pants: safeIndex(pantsColor.value, 3, DEFAULT_LOOK.pants),
    style: safeIndex(hairStyle.value, 3, DEFAULT_LOOK.style),
  };
}

const savedLook = loadLook();
for (const [index, color] of SHIRT_COLORS.entries()) {
  const label = document.createElement("label");
  label.className = "color-option";
  label.title = `สีเสื้อ ${index + 1}`;
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "shirtColor";
  input.value = String(index);
  input.setAttribute("aria-label", `สีเสื้อ ${index + 1}`);
  input.checked = index === savedLook.color;
  const chip = document.createElement("span");
  chip.className = "color-chip";
  chip.style.backgroundColor = color;
  label.append(input, chip);
  shirtColors.append(label);
}
hairColor.value = String(savedLook.hair);
hairStyle.value = String(savedLook.style);
skinTone.value = String(savedLook.skin);
pantsColor.value = String(savedLook.pants);

try { nameInput.value = localStorage.getItem("ro-name") ?? ""; } catch { /* ignore */ }

function addLog(m: ChatMsg) {
  const line = document.createElement("div");
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = m.name + ": ";
  line.append(who, document.createTextNode(m.text)); // ใช้ textContent กัน XSS
  logEl.append(line);
  logEl.scrollTop = logEl.scrollHeight;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim() || "Guest";
  const appearance = selectedLook();
  try {
    localStorage.setItem("ro-name", name);
    localStorage.setItem("ro-look", JSON.stringify(appearance));
  } catch { /* ignore */ }
  setStatus("กำลังเชื่อมต่อ...");
  const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;

  // เซิร์ฟเวอร์ฟรีอาจหลับอยู่ ต้องรอปลุก เลยลองซ้ำให้อัตโนมัติสูงสุด 6 ครั้ง
  let room: Awaited<ReturnType<typeof joinTown>> | undefined;
  for (let attempt = 1; attempt <= 6 && !room; attempt++) {
    try {
      room = await joinTown(name, appearance);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes("INVALID_SESSION")) {
        setStatus("เซิร์ฟเวอร์รีสตาร์ตแล้ว ข้อมูล Guest/ชิปเดิมในหน่วยความจำหมดอายุ");
        const reset = document.createElement("button");
        reset.type = "button";
        reset.textContent = "เริ่ม Guest ใหม่ (100 ชิป)";
        reset.addEventListener("click", () => { forgetGuest(); reset.remove(); submit.disabled = false; setStatus("กดเข้าเมืองเพื่อเริ่ม Guest ใหม่"); });
        loginForm.append(reset);
        return;
      }
      if (attempt === 6) break;
      setStatus(`กำลังปลุกเซิร์ฟเวอร์... (ครั้งที่ ${attempt}/6 อาจรอได้ถึง 1 นาที)`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
  if (!room) {
    submit.disabled = false;
    setStatus("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองรีเฟรชหน้าแล้วกดเข้าเมืองใหม่");
    return;
  }

  login.style.display = "none";
  hud.style.display = "flex";
  setStatus("");

  room.onLeave(() => { setStatus("หลุดจากเซิร์ฟเวอร์ ลองรีเฟรชหน้า"); });

  const townScene = new TownScene(room, addLog);
  new CasinoUI(room, townScene, name);
  // รอฟอนต์พิกเซลโหลดสักครู่ (ไม่เกิน 1.5 วินาที) เพื่อให้ตัวหนังสือในเกมใช้ฟอนต์ถูกตัว
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "Pixelify Sans"'),
        document.fonts.load('16px "Noto Sans Thai"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* ใช้ฟอนต์สำรอง */ }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#1b2230",
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [townScene],
  });

  chatForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    room.send("chat", { text });
    chatInput.value = "";
  });

  const icons: [string, string][] = [["happy", "😄"], ["sad", "😢"], ["love", "❤️"], ["wave", "👋"], ["angry", "💢"], ["sleepy", "💤"]];
  for (const [name, icon] of icons) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = icon;
    b.addEventListener("click", () => room.send("emote", { name }));
    emotesEl.append(b);
  }
});
