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
