-- ============================================================
--  OSO Evaluation - Supabase schema
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งหมด -> Run
-- ============================================================

-- ---------- ตารางรายชื่อ ----------
create table if not exists public.staff (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- ตารางผลประเมิน ----------
-- เก็บคะแนนเป็นตัวเลข 1-5 ต่อหัวข้อ (5 หัวข้อ)
create table if not exists public.evaluations (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  evaluator       text not null,                 -- ผลัด/ชื่อเจ้าหน้าที่ ตม. (ผู้ประเมิน)
  staff           text not null,                 -- เจ้าหน้าที่ Onsite Support
  speed           smallint not null check (speed           between 1 and 5),
  problem_solving smallint not null check (problem_solving between 1 and 5),
  communication   smallint not null check (communication   between 1 and 5),
  service_mind    smallint not null check (service_mind    between 1 and 5),
  satisfaction    smallint not null check (satisfaction    between 1 and 5),
  comment         text
);

create index if not exists evaluations_staff_idx     on public.evaluations (staff);
create index if not exists evaluations_created_idx   on public.evaluations (created_at desc);

-- ============================================================
--  Row Level Security (RLS) - กำหนดสิทธิ์การเข้าถึง
-- ============================================================
alter table public.evaluations enable row level security;
alter table public.staff       enable row level security;
alter table public.shifts      enable row level security;

-- ผู้ประเมินสาธารณะ (anon) = ส่งแบบประเมินได้ (insert) แต่อ่านผลไม่ได้
drop policy if exists "anon insert evaluation" on public.evaluations;
create policy "anon insert evaluation"
  on public.evaluations for insert to anon with check (true);

-- ผู้ล็อกอินแล้ว (Senior/ผู้บริหาร) = อ่าน/แก้/ลบผลประเมินได้ทั้งหมด
drop policy if exists "authed read evaluation" on public.evaluations;
create policy "authed read evaluation"
  on public.evaluations for select to authenticated using (true);

drop policy if exists "authed modify evaluation" on public.evaluations;
create policy "authed modify evaluation"
  on public.evaluations for all to authenticated using (true) with check (true);

-- รายชื่อ staff/shifts = อ่านได้ทุกคน (ใช้เติม dropdown ในฟอร์ม), แก้ได้เฉพาะผู้ล็อกอิน
drop policy if exists "anyone read staff" on public.staff;
create policy "anyone read staff"  on public.staff  for select using (true);
drop policy if exists "authed write staff" on public.staff;
create policy "authed write staff" on public.staff  for all to authenticated using (true) with check (true);

drop policy if exists "anyone read shifts" on public.shifts;
create policy "anyone read shifts"  on public.shifts for select using (true);
drop policy if exists "authed write shifts" on public.shifts;
create policy "authed write shifts" on public.shifts for all to authenticated using (true) with check (true);

-- ============================================================
--  ข้อมูลตัวอย่างเริ่มต้น (ลบออกได้ตามต้องการ)
-- ============================================================
insert into public.shifts (name) values ('ผลัด A'), ('ผลัด B'), ('ผลัด C')
  on conflict (name) do nothing;

insert into public.staff (name) values
  ('สมชาย ใจดี'), ('สมหญิง รักงาน'), ('อนุชา ตั้งใจ')
  on conflict (name) do nothing;

-- ============================================================
--  (ทางเลือก) กันชื่อซ้ำที่ระดับฐานข้อมูล — เทียบแบบ normalize
--  (ตัดช่องว่างหัวท้าย + ยุบช่องว่างซ้ำ + ไม่สนตัวพิมพ์ใหญ่เล็ก)
--  ⚠️ ต้องกดปุ่ม "ล้างชื่อซ้ำ" ในเว็บให้ไม่มีชื่อซ้ำก่อน ไม่งั้นสร้าง index ไม่สำเร็จ
-- ============================================================
create unique index if not exists staff_name_norm_uidx
  on public.staff  (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
create unique index if not exists shifts_name_norm_uidx
  on public.shifts (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- ============================================================
--  เปิด Realtime — ให้แดชบอร์ด/สรุป/รายงาน อัปเดตสดทันทีที่มีการประเมินหรือนำเข้า
--  (รันได้ซ้ำ ไม่ error ถ้าเปิดไว้แล้ว)
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.evaluations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.staff;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.shifts;      exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  บันทึกการใช้งานระบบ (Audit Log) — admin อ่านได้คนเดียว
-- ============================================================
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor      text default (auth.jwt() ->> 'email'),   -- เติมอีเมลผู้ทำจาก JWT อัตโนมัติ (กันปลอม)
  action     text not null,                           -- create / update / delete / import / login ...
  entity     text,                                    -- evaluation / staff / shifts / user / permissions ...
  detail     text
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "log insert authed" on public.audit_log;
create policy "log insert authed" on public.audit_log for insert to authenticated with check (true);
drop policy if exists "log read admin" on public.audit_log;
create policy "log read admin" on public.audit_log for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
--  ตั้งค่าระบบ (เก็บสิทธิ์ของแต่ละบทบาท) — ทุกคนอ่านได้ admin แก้ได้
-- ============================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "settings read authed" on public.app_settings;
create policy "settings read authed" on public.app_settings for select to authenticated using (true);
drop policy if exists "settings write admin" on public.app_settings;
create policy "settings write admin" on public.app_settings for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- เปิด Realtime ให้ app_settings → ผู้ใช้ที่ออนไลน์อยู่จะได้สิทธิ์ใหม่ทันทีเมื่อ admin บันทึก
do $$ begin
  begin alter publication supabase_realtime add table public.app_settings; exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  ชื่อที่แสดงของผู้ใช้ (Display name) — ทุกคนอ่านได้ admin แก้ได้
-- ============================================================
create table if not exists public.profiles (
  email        text primary key,
  display_name text,
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles read authed" on public.profiles;
create policy "profiles read authed" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles write admin" on public.profiles;
create policy "profiles write admin" on public.profiles for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
--  ตั้งให้บัญชี admin เริ่มต้นมี role=admin ใน app_metadata (ให้ RLS ด้านบนทำงาน)
--  *** เปลี่ยนอีเมลให้ตรงกับ admin ของคุณ แล้วให้ admin ออก-เข้าระบบใหม่ 1 ครั้ง ***
-- ============================================================
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  where email = 'nattha.b@somapait.com';

-- ============================================================
--  ลงทะเบียนขอใช้งาน + อนุมัติโดย Admin
--  - ผู้ใช้ลงทะเบียน -> สร้างบัญชี "รออนุมัติ" (ไม่มี role)
--  - Admin กำหนด role ให้ -> จึงเข้าใช้งานได้
--  ⚠️ รันส่วนนี้เพิ่มได้ทันที (idempotent) ไม่กระทบข้อมูลเดิม
-- ============================================================
create table if not exists public.access_requests (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  email       text not null,
  full_name   text,
  reason      text,
  status      text not null default 'pending',   -- pending / approved / rejected
  reviewed_by text,
  reviewed_at timestamptz
);
create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);
alter table public.access_requests enable row level security;
-- เฉพาะ admin อ่าน/จัดการคำขอ (การ insert คำขอทำผ่าน Edge Function register ด้วย service role)
drop policy if exists "req admin all" on public.access_requests;
create policy "req admin all" on public.access_requests for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ------------------------------------------------------------
--  เข้มงวด RLS: ผู้ที่ "ยังไม่ได้รับอนุมัติ" (ไม่มี role) เข้าถึงข้อมูลไม่ได้
--  แม้จะมี session อยู่ ก็อ่าน/แก้ผลประเมินผ่าน API ไม่ได้
-- ------------------------------------------------------------
-- ผลประเมิน: อ่าน/แก้ ต้องเป็น role ที่อนุมัติแล้วเท่านั้น (anon ยัง insert ผ่านฟอร์มสาธารณะได้)
drop policy if exists "authed read evaluation" on public.evaluations;
drop policy if exists "approved read evaluation" on public.evaluations;
create policy "approved read evaluation" on public.evaluations for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));
drop policy if exists "authed modify evaluation" on public.evaluations;
drop policy if exists "approved modify evaluation" on public.evaluations;
create policy "approved modify evaluation" on public.evaluations for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));

-- รายชื่อ staff/shifts: อ่านได้ทุกคน (เติม dropdown ฟอร์ม) แต่แก้ไขต้องเป็น role ที่อนุมัติ
drop policy if exists "authed write staff" on public.staff;
drop policy if exists "approved write staff" on public.staff;
create policy "approved write staff" on public.staff for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));
drop policy if exists "authed write shifts" on public.shifts;
drop policy if exists "approved write shifts" on public.shifts;
create policy "approved write shifts" on public.shifts for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));
