# บ้านป๊อกเด้ง: Server และ Event API

ใช้ Phaser/Vite client + Colyseus 0.15/TypeScript server ของโปรเจกต์เดิม
มี server, shared wire types, บ้านพิกเซลบนแมพ และ UI โต๊ะไพ่ที่เชื่อมแล้ว
ใช้ชิปเล่นในเกมเท่านั้น ไม่มีระบบเติมเงิน/ถอนเงิน

## โมดูล

| ไฟล์ | หน้าที่ |
| --- | --- |
| `server/src/auth/GuestManager.ts` | ออก UUID ลับ, resume guest, เก็บ IP ประกอบ |
| `server/src/economy/EconomyManager.ts` | Wallet, reserve, payout แบบ atomic และ idempotent |
| `server/src/pokdeng/CasinoAccess.ts` | Trigger พิกัดจริง, ticket 30 วินาที, guest อยู่ได้ทีละโต๊ะ |
| `server/src/pokdeng/cards.ts` | สำรับ 52 ใบ, crypto shuffle, แต้ม/ไพ่พิเศษ, house rules |
| `server/src/pokdeng/GameManager.ts` | แปดที่นั่ง, ห้าสถานะ, timeout, reconnect, showdown |
| `server/src/rooms/PokDengRoom.ts` | Colyseus transport และส่ง public/private snapshots |
| `shared/pokdeng.ts` | TypeScript contract สำหรับทั้งสองฝั่ง |
| `client/src/pokdeng/guest.ts` | เก็บ guest UUID ใน LocalStorage และ sync Wallet |
| `client/src/pokdeng/connect.ts` | `joinPokTable()` และ `sendPok()` สำหรับ UI |
| `client/src/pokdeng/CasinoUI.ts` | โต๊ะ 8 ที่นั่ง ไพ่ส่วนตัว ปุ่มเล่น ชิป และ reconnect |
| `shared/casinoWorld.ts` | พิกัดประตูและตัวบ้านที่ใช้ทั้ง Client/Server |

Manager ไม่ผูกกับ Phaser หรือ Colyseus จึงทดสอบหรือเปลี่ยน transport ได้

## Guest และชิป

เข้า `town` ด้วย `{ name, appearance, sessionId? }` โดย `sessionId` เป็น UUID guest
ที่ได้จาก server และเก็บใน `localStorage["ro-guest-session"]` ไม่ใช่ `room.sessionId` ของ Colyseus
เมื่อไม่มี UUID server จะสร้าง guest และแจก 100 ชิปครั้งเดียว
เมื่อกลับด้วย UUID เดิม จะโหลด Wallet เดิมโดยไม่แจกใหม่

`playerId` เป็น UUID อีกชุดหนึ่งสำหรับ public state ส่วน `sessionId` เป็น bearer credential
ส่งเฉพาะเจ้าของผ่าน `auth:ready`; ห้ามแสดงใน UI/URL, public state หรือ log
ไม่เชื่อ `playerId`, balance, IP หรือหน้าไพ่ที่ Client ส่งมา

IP เก็บเป็น `firstIp`/`lastIp` เพื่อบริบทเท่านั้น: IP เดียวกันแยกหลาย guest ได้
และเปลี่ยน IP แล้วยัง resume ได้ ไม่คืน Wallet ด้วย IP อย่างเดียว
ใช้ `request.socket.remoteAddress` โดยปริยาย; ตั้ง `TRUST_PROXY=1` เฉพาะหลัง proxy
ที่ลบ/เขียน `x-forwarded-for` เอง เพราะ Client สามารถปลอม header นี้ได้

ข้อมูลเก็บใน Memory ของ Node process เดียว: server restart จะทำให้ Wallet/UUID หาย
UUID ที่ server ไม่รู้จักจะถูกปฏิเสธด้วย `INVALID_SESSION`; ไม่แจกชิปใหม่เงียบ ๆ
หากยอมเริ่มใหม่หลัง restart ให้ลบ storage key โดยแจ้งผู้ใช้ก่อน
เมื่อล้าง LocalStorage/เปิดอีก browser ก็เป็น guest ใหม่ ระบบนี้ยังไม่ใช่ account ถาวร
หรือการป้องกันคนสร้างหลาย guest เพื่อรับโบนัส; ก่อนขยายใช้จริงควรเพิ่มฐานข้อมูล
และระบบจำกัดการสร้าง guest ตามนโยบายของเกม
การรันหลาย process ต้องใช้ฐานข้อมูล/transaction และ registry กลางแทน Map

Wallet ส่งเฉพาะเจ้าของในรูป `{ balance, reserved, available }`
`balance` เป็นชิปทั้งหมด; `available = balance - reserved` เป็นส่วนที่เดิมพันเพิ่มได้
การลงเดิมพัน 10 ไม่หัก 10 ทันที แต่สำรองความเสี่ยงสูงสุดก่อน แล้วหัก/เพิ่มจริงตอน showdown
ไม่มี public API สำหรับ Client แจก/เพิ่มชิปเอง

## ทางเข้าและห้อง

Door เริ่มที่ `{ x: 960, y: 432, radius: 36 }` ใน `CASINO_DOOR`
TownRoom ตรวจตำแหน่งเท้าจาก simulation ของ server ทุก tick
เมื่อเข้า radius จะหยุดเดินและส่ง `casino:entered` ให้ Client เปิด UI/เข้าห้อง
Client ส่ง `casino:enter` ได้ด้วย แต่ server ตรวจระยะจริงเสมอ
ภาพบ้านและป้ายทางเข้าใน TownScene ใช้พิกัด shared เดียวกัน และ server บล็อกการเดินทะลุตัวบ้าน

Ticket มีอายุ 30 วินาที ผูกกับ guest และใช้เข้าโต๊ะใหม่ได้ครั้งเดียว
หากจะเปิด UI ล่าช้า ให้ส่ง `casino:enter` ใหม่ขณะที่ยังอยู่หน้าประตู
ยังต้องเปิด town connection ค้างระหว่างเล่น; server จะหยุดรับการเดินสำหรับ guest ที่อยู่ในโต๊ะ

`pok_deng` รับ guest ใน logical table สูงสุด 8 คน รวมคนที่ยังไม่เลือกเก้าอี้
ที่นั่ง 0 คือเจ้ามือ ที่นั่ง 1–7 คือลูกมือ การเลือกที่นั่งตรวจและเขียนทันทีใน server
โต๊ะเปิดให้คนเดียวรอได้ แต่เริ่มแจกไพ่ต้องมีเจ้ามือและลูกมือที่เดิมพันอย่างน้อยหนึ่งคน
เมื่อโต๊ะเต็ม `joinOrCreate` อาจสร้างอีกโต๊ะหนึ่งในบ้านเดียวกัน
Guest หนึ่ง UUID อยู่ได้ทีละโต๊ะ และห้ามเปิดสอง connection ในโต๊ะเดียวกัน

ถ้าหลุดระหว่างเดิมพันจะคืนยอด reserve ของผู้เล่นคนนั้น; ถ้าเจ้ามือหลุดจะยกเลิกเดิมพันทั้งหมด
ถ้าหลุดระหว่างรอบ เดิมพันยังมีผลและ timeout จะเล่นให้จน payout
เก็บที่นั่งที่หลุดไว้ 60 วินาที และเก็บผู้ร่วมรอบให้ครบจน payout เสมอ
Rejoin ด้วย `joinById(roomId, { sessionId })` เพื่อคืนมือ/ที่นั่งเดิม โดยไม่ต้องใช้ ticket อีก
การออกโดยสมัครใจระหว่างรอบก็ไม่ยกเลิกการเดิมพัน
เมื่อกลับถึง betting และพ้น grace period จะปล่อยที่นั่ง/registry
Room ที่ไม่เหลือ guest จะ dispose; dispose ก่อนจบรอบคืน reserve ไม่คิดผลรอบที่ยกเลิก

## State machine

`betting → dealing (0.5s) → check_pok (0.5s) → action (15s) → showdown (8s) → betting`

เมื่อ dealer ป๊อก ข้าม action แล้วคิดผลทุกคู่ทันที
ลูกมือป๊อกจะเปิดไพ่ตั้งแต่ check_pok และไม่มีสิทธิ์จั่ว
ผู้เล่นที่ไม่ได้ป๊อก รวมเจ้ามือ เลือก Draw/Stay ได้คนละหนึ่งครั้ง
ต่ำกว่า 4 แต้ม Stay จะถูกปฏิเสธด้วย `MUST_DRAW`
เมื่อหมดเวลา: ต่ำกว่า 4 จั่วให้อัตโนมัติ; ตั้งแต่ 4 Stay อัตโนมัติ
หากทุกคนเลือกครบ จะ showdown ก่อนหมดเวลา
ส่ง `roundId` ไปกับ Draw/Stay เสมอเพื่อปฏิเสธคำสั่งของรอบเก่า
ใช้ `deadline` กับ `serverTime` ใน snapshot สำหรับนับถอยหลัง; client ไม่ได้ตัดสิน timeout

ไพ่เก็บใน private fields ของ GameManager และไม่อยู่ใน Colyseus Schema
`game:hand` ส่งด้วย `client.send` เฉพาะเจ้าของ มีเฉพาะมือเจ้าของ
`table:state` ส่งแค่ cardCount เพื่อวาดหลังไพ่ จนถึงกติกาเปิดป๊อกหรือ showdown
ไพ่ใบที่สามของคนอื่นยังเป็นหลังไพ่จนถึง showdown
Shared types อย่างเดียวไม่ได้เป็น security boundary: public snapshot ถูกสร้างใหม่จาก allowlist

## House rules เริ่มต้น

กติกาป๊อกเด้งแต่ละวงต่างกัน แก้ `DEFAULT_RULES` ฝั่ง server แล้ว deploy ทั้งโต๊ะเป็นชุดเดียว
ค่าอันดับและอัตราจ่ายปรับได้ผ่าน `ranking`/`multipliers` ใน `Rules`

แต้ม A=1, 2–9 ตามหน้าไพ่, 10/J/Q/K=0; ผลรวม modulo 10
ป๊อกเป็นมือสองใบแต้ม 8/9 เท่านั้น ไพ่ใบที่สามไม่มีป๊อก
เรียงนับ A-2-3 ถึง J-Q-K; Q-K-A ไม่นับ และไม่นับ A สูง
เซียนคือไพ่ J/Q/K สามใบที่ไม่ใช่ตองหรือเรียง

| ประเภท | อันดับ (สูงไปต่ำ) | จ่าย |
| --- | --- | --- |
| ป๊อก 9 | 1 | 1 เท่า; 2 เท่าถ้าดอกเดียวกัน |
| ป๊อก 8 | 2 | 1 เท่า; 2 เท่าถ้าดอกเดียวกัน |
| ตอง | 3 | 5 เท่า |
| เรียง | 4 | 3 เท่า |
| เซียน | 5 | 3 เท่า |
| ธรรมดา | 6; เปรียบเทียบแต้ม | 1 เท่า |

ธรรมดาสองใบ: ดอกเดียวกันหรือเลขเดียวกันเป็น 2 เด้ง
ธรรมดาสามใบ: ดอกเดียวกันเป็น 3 เด้ง
ประเภทพิเศษเดียวกัน/ป๊อกเดียวกัน/แต้มธรรมดาเท่ากัน = เสมอ คืนเดิมพัน ไม่ใช้ดอก/เด้ง/เลขสูงตัดสิน
กรณีไพ่เข้าหลายแบบใช้ลำดับตรวจตอง → เรียง → เซียน
ใช้ multiplier ของฝั่งที่ชนะ: ลูกมือชนะตอง รับ `bet × 5`; เจ้ามือชนะตอง ลูกมือเสีย `bet × 5`
ผลสุทธิของเจ้ามือเท่ากับลบผลรวมของลูกมือ จึงไม่มีการสร้างชิปขึ้นระหว่าง payout

สำรองสูงสุด 5 เท่าของ bet ให้ลูกมือ และผลรวม 5 เท่าของเดิมพันทุกคนให้เจ้ามือ
ดังนั้นผู้เล่นใหม่ที่มี 100 ชิปลงขั้นต่ำ 10 ได้ แต่เจ้ามือที่มี 100 รับเดิมพันรวมได้สูงสุด 20
เจ้ามือจะรับลูกมือทั้งเจ็ดที่ขั้นต่ำ 10 ต้องมีชิปว่างอย่างน้อย 350
ส่ง `INSUFFICIENT_CHIPS` ถ้าฝั่งใดฝั่งหนึ่งมีชิปไม่พอ ไม่มีหนี้ติดลบหรือการจ่ายไม่ครบ

## Events

ใช้ handlers ก่อนส่ง sync: ข้อความตอน join อาจเกิดก่อน UI พร้อมรับ

| Client → Server | Payload | ข้อจำกัด |
| --- | --- | --- |
| `auth:sync` | `{}` | town/โต๊ะ; ส่ง credential + Wallet ให้เจ้าของ |
| `wallet:sync` | `{}` | ส่ง Wallet ล่าสุดให้เจ้าของ |
| `casino:locate` | `{}` | town; ตอบ `casino:door` |
| `casino:enter` | `{}` | town; ต้องอยู่ใกล้ประตูจริง |
| `table:sync` | `{}` | ส่ง public snapshot + private hand + Wallet |
| `table:sit` | `{ seat: 0..7 }` | betting, เก้าอี้ต้องว่าง |
| `table:stand` | `{}` | betting; คืน reserve; เจ้ามือลุกยกเลิกทุก bet |
| `table:leave` | `{}` | ปิด connection; รอบที่เริ่มแล้วคิดเงินตามปกติ |
| `game:bet` | `{ amount: 10 }` | betting; integer ≥ minBet และทั้งคู่มี chip reserve พอ |
| `game:cancel_bet` | `{}` | betting |
| `game:start` | `{}` | เจ้ามือเท่านั้น; มีลูกมือเดิมพันที่เชื่อมต่อ |
| `game:draw` | `{ roundId }` | action, ไม่ป๊อก, ยังไม่เลือก, ไม่หมดเวลา |
| `game:stay` | `{ roundId }` | เหมือน draw แต่ต้อง ≥4 แต้ม |

| Server → Client | ข้อมูล |
| --- | --- |
| `auth:ready` | `{ sessionId, playerId, resumed, wallet }` private |
| `wallet:update` | `{ balance, reserved, available }` private |
| `casino:door` | `{ x, y, radius }` |
| `casino:entered` | `{ ticket, expiresAt, roomType, resumeRoomId? }` private |
| `table:state` | public `TableState`: phase, roundId, deadline, 8 seats, showdown results |
| `game:hand` | private `{ roundId, cards, canDraw, canStay, deadline }` |
| `api:error` | `{ event, code, message }`; ไม่มีการเปลี่ยนเงิน/ไพ่เมื่อคำสั่งผิด |

แต่ละ seat มี `playerId, name, connected, dealer, bet, cardCount, acted`
พร้อม `cards/value` เฉพาะที่เปิดตามกติกาแล้ว
`results` มีผลของลูกมือแต่ละคน `{ playerId, outcome, delta, multiplier }`
ผลเจ้ามือคำนวณเป็นลบผลรวม `delta`; Wallet ที่ส่งให้เจ้าของเป็นยอด authoritative หลังคิดเงิน
Join ที่ถูกปฏิเสธคืน Colyseus error เช่น 403 `INVALID_SESSION/INVALID_ENTRY/OTHER_TABLE`
หรือ 409 `ALREADY_CONNECTED/TABLE_FULL`

## ตัวอย่างต่อกับ UI

```ts
import { joinPokTable, sendPok } from "./pokdeng/connect";
import { SERVER_URL } from "./net";
import type { CasinoEntry, TableState } from "../../shared/pokdeng";

let pokerRoom: Awaited<ReturnType<typeof joinPokTable>> | undefined;
let table: TableState | undefined;

townRoom.onMessage("casino:entered", async (entry: CasinoEntry) => {
  if (pokerRoom) return;
  pokerRoom = await joinPokTable(SERVER_URL, entry, characterName, {
    "table:state": state => { table = state; /* render eight seats + face-down/public cards */ },
    "game:hand": hand => { /* render ONLY my cards; disable Stay if !hand.canStay */ },
    "wallet:update": wallet => { /* show balance, available and reserved */ },
    "api:error": error => { /* show a validation message */ },
  });
  pokerRoom.onLeave(() => { pokerRoom = undefined; /* return to town UI */ });
});

// UI button handlers:
sendPok(pokerRoom!, "table:sit", { seat: 0 }); // first guest to take seat 0 becomes dealer
sendPok(pokerRoom!, "game:bet", { amount: 10 }); // seated non-dealer only
sendPok(pokerRoom!, "game:start", {}); // dealer only
sendPok(pokerRoom!, "game:draw", { roundId: table!.roundId! });
sendPok(pokerRoom!, "game:stay", { roundId: table!.roundId! });
sendPok(pokerRoom!, "table:leave", {});
```

UI ต้องเลือกแสดงปุ่มตาม phase/ที่นั่ง ไม่ส่งทุกคำสั่งในตัวอย่างตามลำดับ
อย่า log `auth:ready` หรือ `casino:entered` เพราะมี credential/ticket
ใช้ `roomId` จาก `table:state` เก็บเป็น resume hint แล้ว `joinById` ด้วย UUID เดิมเมื่อ reconnect
หรือเดินไปประตูอีกครั้งเพื่อรับ `resumeRoomId` จาก `casino:entered`

## ตรวจสอบ

```bash
cd server
npm ci
npm run typecheck
npm test
cd ../client
npm ci
npm run build
```

Tests ครอบคลุม auth/IP, reserve/payout, ไพ่พิเศษ, ไพ่ไม่รั่วจาก snapshot,
capacity/seat race, บังคับจั่ว, action replay, disconnect/reconnect และ WebSocket จริง
