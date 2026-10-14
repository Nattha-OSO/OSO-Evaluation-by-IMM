-- ============================================================
--  schema-senior-eval.sql — แบบประเมินเจ้าหน้าที่ Onsite Support โดย Senior
--  รันใน Supabase → SQL Editor (รันซ้ำได้) · ต้องรัน 'ก่อน' ใช้งานลิงก์ ?form=senior
--  ตารางใหม่ 2 ตาราง ไม่แตะตารางเดิม:
--    senior_names        รายชื่อ Senior ผู้ประเมิน (หน้าสาธารณะเลือกได้เฉพาะรายชื่อนี้)
--    senior_evaluations  ผลประเมิน 6 หัวข้อ (ระดับ 1-5 เหมือนแบบประเมิน Onsite เดิม)
--  เกณฑ์: 5 ดีเยี่ยม · 4 ดี · 3 พอใช้ · 2 ต้องปรับปรุง · 1 ไม่ผ่าน
-- ============================================================

-- ---------- รายชื่อ Senior ----------
create table if not exists public.senior_names (
  id    bigint generated always as identity primary key,
  name  text not null unique
);
alter table public.senior_names enable row level security;
drop policy if exists "anyone read senior_names" on public.senior_names;
create policy "anyone read senior_names" on public.senior_names for select using (true);
drop policy if exists "authed write senior_names" on public.senior_names;
create policy "authed write senior_names" on public.senior_names for all to authenticated using (true) with check (true);

-- ---------- ผลประเมิน ----------
create table if not exists public.senior_evaluations (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  senior          text not null,                 -- Senior ผู้ประเมิน
  staff           text not null,                 -- เจ้าหน้าที่ Onsite Support ที่ถูกประเมิน
  troubleshooting smallint not null check (troubleshooting between 1 and 5),  -- 1. การวิเคราะห์และแก้ไขปัญหา
  accuracy        smallint not null check (accuracy        between 1 and 5),  -- 2. ความถูกต้องของการแก้ไขปัญหา
  communication   smallint not null check (communication   between 1 and 5),  -- 3. การสื่อสารกับเจ้าหน้าที่ผู้ใช้งาน
  service_mind    smallint not null check (service_mind    between 1 and 5),  -- 4. มารยาทและการให้บริการ
  case_handling   smallint not null check (case_handling   between 1 and 5),  -- 5. ความถูกต้องในการเปิด/ปิดเคส
  housekeeping    smallint not null check (housekeeping    between 1 and 5),  -- 6. การจัดเก็บเอกสาร อุปกรณ์ และความสะอาด
  comment         text                                                          -- ข้อเสนอแนะเพิ่มเติม
);
create index if not exists senior_evaluations_staff_idx   on public.senior_evaluations (staff);
create index if not exists senior_evaluations_created_idx on public.senior_evaluations (created_at desc);
-- กันนำเข้าซ้ำ (ใช้กับ seed-senior-eval.sql)
create unique index if not exists senior_evaluations_dedup_uidx
  on public.senior_evaluations (created_at, btrim(senior), btrim(staff));

-- ============================================================
--  Row Level Security — เหมือน evaluations / apps_surveys
--   - anon (Senior กรอกผ่านลิงก์) = ส่งแบบประเมินได้ (insert) อ่านผลไม่ได้
--   - role ที่อนุมัติแล้ว (admin/senior/manager) = อ่าน/แก้/ลบได้
-- ============================================================
alter table public.senior_evaluations enable row level security;

drop policy if exists "anon insert senior_eval" on public.senior_evaluations;
create policy "anon insert senior_eval"
  on public.senior_evaluations for insert to anon with check (true);

drop policy if exists "approved read senior_eval" on public.senior_evaluations;
create policy "approved read senior_eval" on public.senior_evaluations for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));

drop policy if exists "approved modify senior_eval" on public.senior_evaluations;
create policy "approved modify senior_eval" on public.senior_evaluations for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));

-- ============================================================
--  Realtime (ไม่บังคับ)
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.senior_evaluations; exception when duplicate_object then null; end;
end $$;
