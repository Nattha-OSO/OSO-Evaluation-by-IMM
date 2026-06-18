# แบบประเมินเจ้าหน้าที่ Onsite Support — Prototype (GitHub Pages + Supabase)

เวอร์ชันทดลองที่ย้ายจาก **Google Apps Script + Google Sheets** มาเป็น
**หน้าเว็บ static (GitHub Pages) + ฐานข้อมูล/Auth (Supabase / PostgreSQL)**

- `index.html` — หน้าเว็บทั้งหมด (ฟอร์มสาธารณะ + ล็อกอิน + แดชบอร์ด) เรียก Supabase ผ่าน `supabase-js` แทน `google.script.run`
- `config.js` — ใส่ค่าเชื่อม Supabase
- `schema.sql` — สร้างตาราง + สิทธิ์ (RLS) + ข้อมูลตัวอย่าง
- `assets/` — โลโก้

---

## ขั้นตอนติดตั้ง (ครั้งเดียว ~10 นาที)

### 1) สร้างโปรเจกต์ Supabase
1. สมัคร/เข้า https://supabase.com → **New project**
2. ตั้งชื่อ, ตั้งรหัส database, **Region: Singapore** (ใกล้ไทยสุด) → Create
3. รอสร้างเสร็จ (~2 นาที)

### 2) สร้างตารางฐานข้อมูล
1. เมนูซ้าย → **SQL Editor** → **New query**
2. เปิดไฟล์ `schema.sql` คัดลอกทั้งหมดไปวาง → กด **Run**
3. ดูที่ **Table Editor** จะเห็นตาราง `evaluations`, `staff`, `shifts`

### 3) ใส่ค่าเชื่อมต่อใน config.js
1. เมนูซ้าย → **Project Settings → Data API** (หรือ **API Keys**)
2. คัดลอก **Project URL** และ **anon public key**
3. เปิด `config.js` วางทับค่า 2 ตัว:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi....(anon key)"
   };
   ```
   > anon key เปิดเผยในเว็บได้อย่างปลอดภัย เพราะข้อมูลถูกคุมด้วย RLS (ผู้ที่ไม่ล็อกอินส่งแบบประเมินได้อย่างเดียว อ่านผลไม่ได้)

### 4) สร้างบัญชีผู้ดูแล (สำหรับเข้าแดชบอร์ด)
1. เมนูซ้าย → **Authentication → Users → Add user** → ใส่ email + password
2. (ถ้ามีการยืนยันอีเมล ให้ติ๊ก Auto Confirm User)
3. email/password นี้ใช้ล็อกอินหน้าแดชบอร์ด

### 5) ทดสอบในเครื่อง
เปิดเทอร์มินัลที่โฟลเดอร์ `Github` แล้วรัน (มี Node อยู่แล้ว):
```powershell
npx serve .
```
เปิดลิงก์ที่ขึ้น (เช่น http://localhost:3000) → ทดสอบส่งแบบประเมิน แล้วล็อกอินดูแดชบอร์ด

---

## นำขึ้น GitHub Pages (ให้ใช้งานออนไลน์)

### วิธี A — เว็บ GitHub (ง่ายสุด ไม่ต้องใช้ git)
1. https://github.com → **New repository** → ตั้งชื่อ เช่น `oso-evaluation` → Create
2. หน้า repo → **Add file → Upload files** → ลากไฟล์ทั้งหมดในโฟลเดอร์ `Github` (รวมโฟลเดอร์ `assets`) ขึ้นไป → Commit
3. **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / โฟลเดอร์ `/ (root)` → Save
4. รอ ~1 นาที จะได้ลิงก์ `https://<username>.github.io/oso-evaluation/`

### วิธี B — ผ่าน git (คอมมานด์)
```bash
cd "D:/Ai Tools/Claude/OSO Evaluation by IMM/Github"
git init
git add .
git commit -m "OSO Evaluation prototype (GitHub Pages + Supabase)"
git branch -M main
git remote add origin https://github.com/<username>/oso-evaluation.git
git push -u origin main
```
แล้วไปเปิด **Settings → Pages** ตามวิธี A ข้อ 3

---

## สิ่งที่ prototype นี้มี
- ✅ ฟอร์มประเมินสาธารณะ (ไม่ต้องล็อกอิน) — บังคับครบ 5 หัวข้อ, ไฮไลต์หัวข้อที่ขาด
- ✅ ล็อกอิน (Supabase Auth) → แดชบอร์ด: การ์ดสรุป, คะแนนเฉลี่ยรายหัวข้อ, ตารางรายการ
- ✅ ส่งออก CSV
- ✅ ดีไซน์/โลโก้/ธีมสีน้ำเงิน เหมือนระบบเดิม

## ส่วนที่ยังไม่ได้ย้าย (ทำต่อได้)
- รายงาน DOCX/PDF (ของเดิมใช้ฝั่งเซิร์ฟเวอร์ Apps Script — ทำเป็น Supabase Edge Function ได้)
- จัดการผู้ใช้/บทบาท (viewer/senior/admin) แบบละเอียด, จัดการรายชื่อในหน้าเว็บ
- การวิเคราะห์เชิงลึก (radar, คำสำคัญ)

## หมายเหตุเรื่องข้อมูล
ข้อมูลจะอยู่บน Supabase cloud (Singapore) — หากนโยบาย ตม. ต้องการให้ข้อมูลอยู่ในองค์กร
ให้พิจารณา **PocketBase** หรือเซิร์ฟเวอร์ภายในแทน (โครงสร้างหน้าเว็บนี้นำไปต่อได้)
