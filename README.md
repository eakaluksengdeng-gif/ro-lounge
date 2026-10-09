# RO Lounge — โปรเจกต์ตั้งต้น

เกม social hub 2D บนเว็บ แนว RO แต่ไม่มีมอนสเตอร์ เดิน แชท และ emote ร่วมกันแบบ realtime

Stack: Phaser 3 + Vite (client) · Colyseus + Node (server) · TypeScript ทั้งสองฝั่ง

## วิธีรัน (ต้องมี Node 18+)

เปิดสอง terminal

```bash
# terminal 1: เซิร์ฟเวอร์ (พอร์ต 2567)
cd server
npm install
npm run dev

# terminal 2: หน้าเว็บ
cd client
npm install
npm run dev
```

เปิด http://localhost:5173 สองแท็บ ใส่ชื่อคนละชื่อ แล้วลองคลิกพื้นเพื่อเดิน พิมพ์แชท และกดปุ่ม emote

## ทำอะไรได้แล้ว (เฟส 1–4 ในแผน)

- คลิกพื้นเพื่อเดิน เซิร์ฟเวอร์ขยับตัวละครด้วยความเร็วคงที่ กันโกง
- เห็นผู้เล่นทุกคนในห้อง ตัวละครหายเมื่อออก
- แชทลอยเหนือหัว 5 วินาที + log ด้านล่าง (จำกัด 120 ตัวอักษร, ส่งได้ทุก 0.7 วินาที)
- emote 6 แบบ
- กราฟิกทั้งหมดวาดจากโค้ด ยังไม่ต้องมีไฟล์ภาพ

## ยังไม่มี

ล็อกอินและบันทึกตัวละคร, หลายแมพ, ตัวกรองคำหยาบ, report/mute, sprite จริง

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
| --- | --- |
| `server/src/rooms/TownRoom.ts` | ตรรกะห้อง: เดิน แชท emote |
| `server/src/schema/TownState.ts` | state ที่ซิงก์ให้ทุก client |
| `client/src/scenes/TownScene.ts` | วาดแมพ ตัวละคร bubble |
| `client/src/main.ts` | หน้าเข้าเกม แชท ปุ่ม emote |
| `client/src/net.ts` | เชื่อมต่อเซิร์ฟเวอร์ |

## ตอน deploy

ตั้งตัวแปร `VITE_SERVER_URL` (เช่น `wss://your-game-server.fly.dev`) ตอน build ฝั่ง client
เซิร์ฟเวอร์ต้องรันเป็นโปรเซสค้าง (Fly.io, Railway, VPS) ไม่ใช่ serverless

## ขึ้นออนไลน์ให้เพื่อนเล่น

1. ดันโปรเจกต์ขึ้น GitHub (repo เดียว มีโฟลเดอร์ server กับ client)
2. **เซิร์ฟเวอร์เกม** (Railway หรือ Render): ชี้ไปที่ repo ตั้ง Root Directory = `server`,
   Build = `npm install`, Start = `npm start` ได้ URL เช่น `https://xxx.up.railway.app`
   ตรวจว่าเปิด `https://xxx.../health` แล้วขึ้น `ok`
3. **หน้าเว็บ** (Vercel, Netlify หรือ Cloudflare Pages): ตั้ง Root Directory = `client`,
   Build = `npm run build`, Output = `dist` และตั้ง Environment Variable
   `VITE_SERVER_URL=wss://xxx.up.railway.app` (ใช้ wss:// ไม่ใช่ https://) ก่อน build
4. ส่งลิงก์หน้าเว็บให้เพื่อน

หมายเหตุ: แพ็กเกจฟรีบางเจ้า (เช่น Render) จะหลับเมื่อไม่มีคนใช้ เปิดครั้งแรกอาจรอ 30–60 วินาที
