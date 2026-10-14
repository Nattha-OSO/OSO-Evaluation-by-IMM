// รัน: ต้องมี @electric-sql/pglite (npm i ในโฟลเดอร์ชั่วคราว แล้ว NODE_PATH=<path>/node_modules node test-senior-sql.cjs) — ทดสอบ schema+seed+RLS บน Postgres จริง
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const G = require('path').join(__dirname, '/');
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.jwt() returns jsonb language sql as $$ select '{"app_metadata":{"role":"senior"}}'::jsonb $$;
    create publication supabase_realtime;
    create table public.staff (id bigint generated always as identity primary key, name text not null);
    insert into public.staff(name) values ('นายเกษมพงศ์ พันธุ์พิพัฒน์ (มาร์ค)');
  `);
  const schema = fs.readFileSync(G + 'schema-senior-eval.sql', 'utf8');
  await db.exec(schema); console.log('schema ok'); await db.exec(schema); console.log('schema re-run ok');
  const seed = fs.readFileSync(G + 'seed-senior-eval.sql', 'utf8');
  await db.exec(seed); console.log('seed ok'); await db.exec(seed); console.log('seed re-run ok (idempotent)');
  const n = await db.query('select count(*)::int c from public.senior_evaluations'); console.log('rows', n.rows[0].c);
  const s = await db.query('select count(*)::int c from public.staff'); console.log('staff', s.rows[0].c);
  const sn = await db.query('select name from public.senior_names order by 1'); console.log('seniors', JSON.stringify(sn.rows));
  const r = await db.query("select created_at at time zone 'Asia/Bangkok' as t, senior, staff, troubleshooting, housekeeping, left(comment,30) c from public.senior_evaluations order by created_at limit 3"); console.log(JSON.stringify(r.rows));
  const q = await db.query("select count(*)::int c from public.senior_evaluations where comment like '%CISCO%' "); console.log('apostrophe/quote row ok', q.rows[0].c);
  // check constraint
  try { await db.exec("insert into public.senior_evaluations(senior,staff,troubleshooting,accuracy,communication,service_mind,case_handling,housekeeping) values('a','b',6,1,1,1,1,1)"); console.log('FAIL: check not enforced'); } catch (e) { console.log('check constraint enforced'); }
  // policies via role
  await db.exec('grant usage on schema public to anon, authenticated; grant all on all tables in schema public to anon, authenticated; grant usage on all sequences in schema public to anon, authenticated; grant usage on schema auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated; set role anon');
  await db.exec("insert into public.senior_evaluations(senior,staff,troubleshooting,accuracy,communication,service_mind,case_handling,housekeeping) values('a','b',5,5,5,5,5,5)"); console.log('anon insert allowed');
  const ar = await db.query('select count(*)::int c from public.senior_evaluations'); console.log('anon read rows (expect 0):', ar.rows[0].c);
  const asn = await db.query('select count(*)::int c from public.senior_names'); console.log('anon read senior_names (expect 2):', asn.rows[0].c);
  await db.exec('reset role; set role authenticated');
  const au = await db.query('select count(*)::int c from public.senior_evaluations'); console.log('authenticated(senior) read rows:', au.rows[0].c);
  await db.exec("delete from public.senior_evaluations where senior='a'"); const au2 = await db.query('select count(*)::int c from public.senior_evaluations'); console.log('authenticated delete ok, rows now', au2.rows[0].c);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
