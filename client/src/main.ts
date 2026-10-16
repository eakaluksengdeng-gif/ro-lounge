import Phaser from "phaser";
import { joinTown, type ChatMsg } from "./net";
import { TownScene } from "./scenes/TownScene";
import { CasinoUI } from "./pokdeng/CasinoUI";
import { forgetGuest } from "./pokdeng/guest";
import { CharacterCreator } from "./character/CharacterCreator";
import { NatureUI } from "./nature/NatureUI";
import { gameSounds } from "./audio/GameSounds";
import { WorldUI } from "./world/WorldUI";
import { loadReferenceArt,artCanvas } from './reference/Assets';
import './reference/reference.css';
import './reference/activities.css';
import './world/modern.css';
import './world/collection.css';
import './nature/fishing-layout.css';
import './world/season.css';
import './world/nearby.css';
import {installVillageMigration} from './migration/PlayerTransfer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const login = $("login");
const loginForm = $<HTMLFormElement>("loginForm");
const nameInput = $<HTMLInputElement>("nameInput");
const hud = $("hud");
const logEl = $("log");
const chatForm = $<HTMLFormElement>("chatForm");
const chatInput = $<HTMLInputElement>("chatInput");
const emotesEl = $("emotes");
const statusEl = $("status");
installVillageMigration(loginForm);
gameSounds.bindGestures();
const soundTools = document.createElement("div");
soundTools.className = "creator-sound-tools";
const badge = loginForm.querySelector(".creator-badge");
if (badge) soundTools.append(badge);
soundTools.append(gameSounds.createMusicControl(), gameSounds.createToggle());
loginForm.querySelector("header")?.append(soundTools);
const setStatus = (t: string) => {
  statusEl.textContent = t;
  statusEl.style.display = t ? "block" : "none";
};

try { nameInput.value = localStorage.getItem("ro-name") ?? ""; } catch { /* ignore */ }
let creator:CharacterCreator;
const enter=loginForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
enter.disabled=true;setStatus('กำลังโหลดภาพตัวละครและโลก…');
const artReady=loadReferenceArt().then(()=>{creator=new CharacterCreator($("customize"),nameInput);enter.disabled=false;setStatus('');});
artReady.catch(()=>setStatus('โหลดภาพไม่สำเร็จ กรุณารีเฟรชหน้าเพื่อลองใหม่'));

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
  try {await artReady;}catch{return;}
  const name = nameInput.value.trim() || "Guest";
  const appearance = creator.selectedLook();
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
        gameSounds.play("error");
        setStatus("ไม่พบ Guest เดิมในข้อมูลเซิร์ฟเวอร์ (อาจเป็น Guest ก่อนเปลี่ยนระบบเซฟ) กรุณายืนยันเริ่มใหม่");
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
    gameSounds.play("error");
    submit.disabled = false;
    setStatus("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองรีเฟรชหน้าแล้วกดเข้าเมืองใหม่");
    return;
  }

  login.style.display = "none";
  hud.style.display = "flex";
  setStatus("");
  gameSounds.setWorld("town");
  gameSounds.play("join");

  room.onLeave(() => { gameSounds.setWorld("disconnected"); gameSounds.play("error"); setStatus("หลุดจากเซิร์ฟเวอร์ ลองรีเฟรชหน้า"); });

  const townScene = new TownScene(room, addLog);
  new CasinoUI(room, townScene, name);
  new NatureUI(room, townScene);
  new WorldUI(room, townScene);
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
    audio: { noAudio: true }, // One shared Web Audio mixer handles the DOM UI and Phaser world.
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#1b2230",
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [townScene],
  });
  // Local browser QA only. Vite removes this branch entirely from the production bundle.
  if ((import.meta as any).env.DEV) window.dispatchEvent(new CustomEvent("ro:dev-scene", { detail: townScene }));

  chatForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    room.send("chat", { text });
    chatInput.value = "";
  });

  const icons: [string, string][] = [["happy", "ดีใจ"], ["sad", "เศร้า"], ["love", "รัก"], ["wave", "ทักทาย"], ["angry", "โกรธ"], ["sleepy", "ง่วง"]];
  for (const [name, icon] of icons) {
    const b = document.createElement("button");
    b.type = "button";
    const image=artCanvas('emote-'+name,32);image.style.imageRendering='pixelated';b.append(image);b.title=icon;b.setAttribute('aria-label',icon);
    b.addEventListener("click", () => room.send("emote", { name }));
    emotesEl.append(b);
  }
  emotesEl.append(gameSounds.createMusicControl());
});
