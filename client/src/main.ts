import Phaser from "phaser";
import { joinTown, type ChatMsg } from "./net";
import { TownScene } from "./scenes/TownScene";

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
  try { localStorage.setItem("ro-name", name); } catch { /* ignore */ }
  statusEl.textContent = "กำลังเชื่อมต่อ...";

  let room;
  try {
    room = await joinTown(name);
  } catch (err) {
    statusEl.textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (รัน server แล้วหรือยัง?)";
    console.error(err);
    return;
  }

  login.style.display = "none";
  hud.style.display = "flex";
  statusEl.textContent = "";

  room.onLeave(() => { statusEl.textContent = "หลุดจากเซิร์ฟเวอร์ ลองรีเฟรชหน้า"; });

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#1e2a38",
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new TownScene(room, addLog)],
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
