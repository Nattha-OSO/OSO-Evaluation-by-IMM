# การจัดการผู้ใช้ระบบ (Roles: admin / senior / manager)

ระบบสิทธิ์:
- **admin** — จัดการผู้ใช้ได้ (เพิ่ม/ลบบัญชีล็อกอิน + กำหนดสิทธิ์) เห็นเมนู "จัดการผู้ใช้ระบบ"
- **senior**, **manager** — ใช้งานทุกอย่างได้ **ยกเว้น** จัดการผู้ใช้ (ไม่เห็นเมนูนี้)

การสร้าง/ลบบัญชีล็อกอินจริงต้องใช้ `service_role` จึงทำผ่าน **Supabase Edge Function** ชื่อ `admin-users`
(โค้ดอยู่ที่ `supabase/functions/admin-users/index.ts`)

---

## ติดตั้ง Edge Function (ทำครั้งเดียว)

เปิด PowerShell ที่โฟลเดอร์ `Github` (มี Node อยู่แล้ว ใช้ `npx` ได้เลย):

```powershell
cd "D:\Ai Tools\Claude\OSO Evaluation by IMM\Github"

# 1) ล็อกอิน Supabase CLI (เปิดเบราว์เซอร์ให้กดอนุญาต)
npx supabase login

# 2) เชื่อมกับโปรเจกต์ (project-ref = ส่วนหน้าของ URL)
npx supabase link --project-ref hokuuilqvfdeekchqelz

# 3) ตั้งอีเมล admin เริ่มต้น (bootstrap) — บัญชีนี้จะเป็น admin ทันที
npx supabase secrets set ADMIN_EMAILS="nattha.b@somapait.com"

# 4) deploy ฟังก์ชัน
npx supabase functions deploy admin-users
```

> ถ้าถาม project password ตอน link ให้ใส่รหัส database ที่ตั้งตอนสร้างโปรเจกต์

---

## ใช้งาน
1. ล็อกอินด้วยบัญชีที่อยู่ใน `ADMIN_EMAILS` → จะเห็นเมนู **"จัดการผู้ใช้ระบบ (admin)"** ที่แถบซ้าย
2. ในหน้านั้น:
   - **เพิ่มผู้ใช้**: กรอก email + รหัสผ่าน + เลือกสิทธิ์ (admin/senior/manager) → กดเพิ่ม (บัญชีถูกยืนยันอีเมลให้อัตโนมัติ)
   - **เปลี่ยนสิทธิ์**: เลือกจาก dropdown ในตาราง
   - **ลบ**: กดปุ่มลบ (ลบบัญชีตัวเองไม่ได้)
3. ผู้ใช้ที่ถูกตั้งเป็น senior/manager เมื่อล็อกอินจะ **ไม่เห็นเมนูจัดการผู้ใช้** และเข้าหน้านั้นไม่ได้ (กันทั้งฝั่งเว็บและฝั่ง Edge Function)

---

## เพิ่ม admin คนอื่น
2 วิธี:
- ในหน้าจัดการผู้ใช้ เปลี่ยน role ของคนนั้นเป็น `admin` (วิธีง่ายสุด)
- หรือเพิ่มอีเมลใน secret: `npx supabase secrets set ADMIN_EMAILS="a@x.com,b@y.com"` แล้ว deploy ใหม่

---

## หมายเหตุความปลอดภัย
- `service_role` อยู่ใน Edge Function (ฝั่งเซิร์ฟเวอร์) เท่านั้น **ไม่เคยอยู่ในหน้าเว็บ/Git**
- ฟังก์ชันตรวจสอบ JWT ผู้เรียกทุกครั้งว่าเป็น admin จริงก่อนทำงาน (ไม่ใช่แค่ซ่อนเมนู)
- ถ้ายังไม่ deploy ฟังก์ชัน เมนูจัดการผู้ใช้จะซ่อนอัตโนมัติ และส่วนอื่นของระบบใช้งานได้ปกติ
