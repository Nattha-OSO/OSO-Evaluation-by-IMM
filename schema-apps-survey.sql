-- ============================================================
--  OSO Evaluation — โมดูลเสริม: แบบประเมินความพึงพอใจระบบ APPS / PNR
--  (แยกจากตาราง evaluations เดิม — เพิ่มเข้าไปได้เลย ไม่กระทบข้อมูลเดิม)
--  วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งหมด -> Run  (รันซ้ำได้ idempotent)
--
--  เกณฑ์คะแนน (4 ระดับ):  ดีเยี่ยม=4 · ดี=3 · ปานกลาง=2 · ควรปรับปรุง=1
--  ร้อยละต่อหัวข้อ = ผลรวมคะแนน / (จำนวนผู้ตอบ × 4) × 100
--    80-100 = ดีเยี่ยม · 60-79 = ดี · 40-59 = ปานกลาง · 0-39 = ควรปรับปรุง
-- ============================================================

create table if not exists public.apps_surveys (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),

  -- ข้อมูลผู้ประเมิน
  agency      text not null,          -- เจ้าหน้าที่หน่วยงานใด (IMMIGRATION / CUSTOMS / SBB / ONCB ...)
  airport     text not null,          -- เจ้าหน้าที่ประจำท่าอากาศยาน
  duration    text not null,          -- ระยะเวลาการใช้งานระบบ APPS

  -- ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน (3 หัวข้อ)
  s1_1        smallint not null check (s1_1 between 1 and 4),  -- มีความรู้ความสามารถ
  s1_2        smallint not null check (s1_2 between 1 and 4),  -- การปฏิบัติตามนโยบาย กฎ ระเบียบ
  s1_3        smallint not null check (s1_3 between 1 and 4),  -- คุณภาพการให้บริการ

  -- ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ APPS และศูนย์บริการ (Service Desk) (7 หัวข้อ)
  s2_1        smallint not null check (s2_1 between 1 and 4),  -- ระบบมีประสิทธิภาพ
  s2_2        smallint not null check (s2_2 between 1 and 4),  -- ระบบมีประโยชน์
  s2_3        smallint not null check (s2_3 between 1 and 4),  -- ใช้งานง่าย
  s2_4        smallint not null check (s2_4 between 1 and 4),  -- คู่มือช่วยเพิ่มความเข้าใจ
  s2_5        smallint not null check (s2_5 between 1 and 4),  -- ความสะดวกในการติดต่อ
  s2_6        smallint not null check (s2_6 between 1 and 4),  -- การรับแจ้งปัญหา/คำแนะนำ
  s2_7        smallint not null check (s2_7 between 1 and 4),  -- การแจ้งข่าวสาร Upgrade ระบบ

  -- ส่วนที่ 3 : ข้อเสนอแนะเพิ่มเติม
  suggestion  text
);

create index if not exists apps_surveys_created_idx on public.apps_surveys (created_at desc);
create index if not exists apps_surveys_agency_idx  on public.apps_surveys (agency);

-- ============================================================
--  Row Level Security — เหมือน evaluations เดิม
--   - anon (ผู้ประเมินสาธารณะ) = ส่งแบบประเมินได้ (insert) อ่านผลไม่ได้
--   - role ที่อนุมัติแล้ว (admin/senior/manager) = อ่าน/แก้/ลบได้
-- ============================================================
alter table public.apps_surveys enable row level security;

drop policy if exists "anon insert apps_survey" on public.apps_surveys;
create policy "anon insert apps_survey"
  on public.apps_surveys for insert to anon with check (true);

drop policy if exists "approved read apps_survey" on public.apps_surveys;
create policy "approved read apps_survey" on public.apps_surveys for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));

drop policy if exists "approved modify apps_survey" on public.apps_surveys;
create policy "approved modify apps_survey" on public.apps_surveys for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','senior','manager'));

-- ============================================================
--  (ทางเลือก) กันรายการซ้ำทุกช่องที่ระดับฐานข้อมูล
--   ⚠️ ต้องกดปุ่ม "ลบรายการซ้ำ" ในเว็บให้ไม่มีรายการซ้ำก่อน จึงจะสร้าง index สำเร็จ
-- ============================================================
create unique index if not exists apps_surveys_dedup_uidx
  on public.apps_surveys (
    created_at, btrim(agency), btrim(airport), btrim(duration),
    s1_1, s1_2, s1_3,
    s2_1, s2_2, s2_3, s2_4, s2_5, s2_6, s2_7,
    coalesce(btrim(suggestion), '')
  );

-- ============================================================
--  เปิด Realtime — ให้แดชบอร์ด/รายงาน อัปเดตสดทันทีที่มีการประเมินหรือนำเข้า
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.apps_surveys; exception when duplicate_object then null; end;
end $$;
