# ตั้งค่าเซฟถาวรด้วย Supabase Free

ผู้ใช้ยืนยันให้เปลี่ยน Guest เดิมที่เก็บใน memory เป็น Guest ใหม่ 100 ชิปหนึ่งครั้ง และเลือก Supabase Free แล้ว
ตั้งฐานข้อมูลและคีย์ฝั่งเซิร์ฟเวอร์เรียบร้อยแล้วและปล่อย Cozy World ผ่าน PR #15; ขั้นตอนข้างล่างสำหรับติดตั้งใหม่ ไม่ใช่คำสั่งให้รีเซ็ตข้อมูลที่ใช้งานอยู่

1. เข้า https://supabase.com/dashboard ล็อกอินด้วย GitHub สร้างองค์กร Free และโปรเจกต์ ro-lounge
2. ตั้งรหัสผ่านฐานข้อมูลเก็บไว้ส่วนตัว; ไม่ต้องใช้รหัสผ่านนี้ในโค้ดเกมหรือส่งในแชท
3. เปิด SQL Editor → New query แล้ววางเนื้อหา server/storage.sql และกด Run (สร้าง table/function แบบไม่ลบข้อมูลเดิม)
4. ใน Project Settings / Data API คัดลอก Project URL; ใน API Keys คัดลอก Secret key ที่ขึ้นต้น sb_secret_ (หรือ legacy service_role)
5. เปิด Render → ro-lounge → Environment เพิ่ม SUPABASE_URL และ SUPABASE_SECRET_KEY; คีย์ legacy ใช้ SUPABASE_SERVICE_ROLE_KEY แทน
6. คีย์นี้อยู่เฉพาะ server; ห้ามใส่ VITE_*, GitHub commit, ภาพ screenshot หรือส่งในแชท
7. หลังปล่อย ตรวจ /version ต้องเป็น cozy-world-v1 และ durableStorage:true; ทดลอง Guest ใหม่ หา item แล้วทดสอบ restart/resume

ตรวจการเชื่อมต่อแล้ว: โปรเจกต์ ro-lounge บน Free มี table/RPC ตาม migration และทดสอบ save, idempotent retry, stale revision สำเร็จโดย rollback ธุรกรรมทดสอบ จึงไม่เปลี่ยนข้อมูลจริง
Render ให้เลือก Save only ตอนเพิ่มคีย์ ก่อน merge โค้ดใหม่ เพื่อลดการ restart ระบบ memory เดิมโดยไม่จำเป็น
Supabase MCP ไม่คืน server Secret key; ผู้ใช้คัดลอกจาก API Keys ใส่ Render Environment เอง ห้ามส่งคีย์ในแชท
ทดสอบ restart/resume บนเว็บจริงผ่านแล้ว 2026-10-15: Guest เดิมได้ยอด 104 ชิป หมวกเชฟ ของสะสมและแปลงแครอทที่รดน้ำไว้คืนครบ โดยไม่ได้สร้าง Guest หรือแจก 100 ชิปใหม่

Free มีโควตาและอาจ pause เมื่อไม่ได้ใช้งานตามนโยบายบริการ; ไม่ใช่บริการเซฟไร้ขีดจำกัดหรือการรับประกัน uptime
อ้างอิง https://supabase.com/docs/guides/getting-started/api-keys และ https://supabase.com/docs/guides/platform/free-project-pausing

## วิธีทำงานของเซฟ

- Snapshot JSON เดียวบันทึก Guest, wallet/settlement/reward ledger, fish inventory, world progress และฟาร์ม
- ทุกการเปลี่ยนข้อมูลถาวรมี save barrier ก่อนส่งคำยืนยัน/ยอดเงิน; เรียง operations โดยไม่ block Node movement loop
- SQL บันทึกทั้ง snapshot แบบ atomic พร้อม revision compare-and-swap; writer เก่าหรือ instance ที่แข่งกันเขียนจะถูกปฏิเสธ
- table เปิด RLS และไม่ให้ anon/authenticated อ่านหรือเขียน; RPC ให้เฉพาะ service_role
- หนึ่งเกมหนึ่ง server process; ยังไม่ใช่ระบบกระจายหลาย replica แบบ horizontal scaling
- ถ้า DB ล่ม ไม่ส่ง false acknowledgement; operation ที่รอบันทึกต้อง flush สำเร็จก่อนรับ operation ถาวรถัดไป
- คาเฟ่/เรือ/โต๊ะที่กำลังเล่นไม่เก็บเป็น active room หลัง process restart; กระเป๋า ของสะสม แปลง ชุด และผลที่คิดแล้วเก็บ
- การ restart ยกเลิกมือไพ่ที่ยังไม่ settle และคืนเฉพาะเงินสำรองที่ยังไม่ได้หัก; ไม่คืนเงินที่เล่นแพ้และ settle ไปแล้ว
- ในเครื่องไม่มี Supabase ใช้ atomic file server/data/world.json (gitignored); production Render ไม่ยอม fallback ลง ephemeral disk

## ข้อจำกัดก่อนเปิดคนจำนวนมาก

Snapshot mode เหมาะสำหรับ social prototype ขนาดเล็ก แต่ snapshot โตตามจำนวน Guest/ของสะสม
ต้อง monitor ขนาดและ latency; รุ่นขยายควรเปลี่ยนเป็นตารางรายผู้เล่นและ transaction/ledger แยก โดยคง validation และ privacy เดิม
Guest เป็น bearer session ใน browser เครื่องเดิม ไม่ใช่ระบบ account recovery ข้ามอุปกรณ์หรือป้องกันผู้เล่นสร้างหลาย Guest
