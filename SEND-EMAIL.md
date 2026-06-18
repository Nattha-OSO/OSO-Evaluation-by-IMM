# ส่งรายงานทางอีเมล (PDF)

ในหน้าต่าง "รายงาน DOCX":
- **👁 ดูตัวอย่าง PDF** — เปิดหน้าตัวอย่างรายงาน (กด Ctrl+P เพื่อบันทึกเป็น PDF ได้เลย) — **ใช้ได้ทันที ไม่ต้องตั้งค่าอะไร**
- **✉ ส่งอีเมล (PDF)** — สร้าง PDF แล้วส่งไปยังอีเมลที่ระบุ — **ต้องตั้งค่า SMTP + deploy ฟังก์ชันก่อน** (ทำครั้งเดียว)

---

## ตั้งค่าส่งอีเมล (ครั้งเดียว)

ส่งอีเมลจากเว็บ static ต้องมีตัวกลาง — ใช้ **Supabase Edge Function `send-report`** ส่งผ่าน SMTP
(โค้ดอยู่ที่ `supabase/functions/send-report/index.ts`)

### 1) เตรียม SMTP (เลือกอย่างใดอย่างหนึ่ง)

**ก) Gmail** (ง่ายสุดสำหรับทดสอบ)
1. เปิด 2-Step Verification ในบัญชี Google
2. สร้าง **App password**: https://myaccount.google.com/apppasswords → ได้รหัส 16 ตัว
3. ค่า: `SMTP_HOST=smtp.gmail.com` · `SMTP_PORT=465` · `SMTP_USER=you@gmail.com` · `SMTP_PASS=<app password>` · `SMTP_FROM=you@gmail.com`

**ข) เมลองค์กร (เช่น somapait.com / Zimbra)**
- ขอค่า SMTP จากผู้ดูแลเมล: host, port (465 SSL หรือ 587), user, password

### 2) ตั้งความลับ + deploy (PowerShell ที่โฟลเดอร์ Github)
```powershell
cd "D:\Ai Tools\Claude\OSO Evaluation by IMM\Github"
$env:SUPABASE_ACCESS_TOKEN="<โทเค็นจริงจาก https://supabase.com/dashboard/account/tokens>"

npx supabase secrets set SMTP_HOST="smtp.gmail.com" SMTP_PORT="465" SMTP_USER="you@gmail.com" SMTP_PASS="app-password-16-chars" SMTP_FROM="you@gmail.com" --project-ref hokuuilqvfdeekchqelz

npx supabase functions deploy send-report --project-ref hokuuilqvfdeekchqelz --use-api
```
> ⚠️ อย่าวางโทเค็น/รหัสผ่านในแชต — ใช้เฉพาะในหน้าต่าง PowerShell · เสร็จแล้วเพิกถอนโทเค็นได้

### 3) ใช้งาน
หน้ารายงาน → เลือกช่วง → กรอกอีเมลผู้รับ (หลายคนคั่นด้วย ,) → **ดูตัวอย่าง** → **ส่งอีเมล** → ผู้รับได้อีเมลแนบ PDF

---

## หมายเหตุ
- ถ้ายังไม่ตั้งค่า/ยังไม่ deploy: ปุ่มส่งอีเมลจะขึ้นข้อความว่ายังไม่ได้ตั้งค่า SMTP — แต่ **ดูตัวอย่าง + บันทึก PDF เองได้ปกติ**
- PDF สร้างฝั่งเบราว์เซอร์ (html2pdf) รองรับภาษาไทย
- การส่งอีเมลถูกบันทึกใน Audit Log (admin ดูได้)
