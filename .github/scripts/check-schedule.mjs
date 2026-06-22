// ด่านเช็กเบาๆ ก่อนเปิดเบราว์เซอร์: อ่าน "ตารางเวลาส่งรายงาน" (anon) จาก Supabase
//  -> ถ้าตรงวัน+เวลา (ตามเวลาไทย) และเปิดอยู่ จึงให้ขั้นถัดไปทำงาน
//  ผลลัพธ์เขียนลง $GITHUB_OUTPUT เป็น go=true/false
import fs from 'fs';

function setOut(go, reason) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'go=' + go + '\n');
  console.log((go ? '▶ RUN' : '⏭ SKIP') + ': ' + reason);
}

// กดรันเองจากแท็บ Actions = ส่งทันที (ข้ามการเช็กเวลา)
if (process.env.FORCE === 'true') { setOut(true, 'manual dispatch (workflow_dispatch)'); process.exit(0); }

// อ่านค่า Supabase จาก config.js (anon key เป็นค่าสาธารณะอยู่แล้ว)
let url, anon;
try {
  const t = fs.readFileSync('config.js', 'utf8');
  url = (t.match(/SUPABASE_URL\s*:\s*["']([^"']+)["']/) || [])[1];
  anon = (t.match(/SUPABASE_ANON_KEY\s*:\s*["']([^"']+)["']/) || [])[1];
} catch (e) { /* ignore */ }
if (!url || !anon) { setOut(false, 'อ่าน config.js ไม่ได้'); process.exit(0); }

try {
  const res = await fetch(url + '/rest/v1/app_settings?key=eq.auto_report_sched&select=value', {
    headers: { apikey: anon, Authorization: 'Bearer ' + anon },
  });
  const rows = await res.json();
  const cfg = (Array.isArray(rows) && rows[0] && rows[0].value) || {};
  if (cfg.enabled !== true) { setOut(false, 'ปิดการส่งอัตโนมัติอยู่'); process.exit(0); }

  const th = new Date(Date.now() + 7 * 3600 * 1000);  // เวลาไทย (UTC+7)
  const day = th.getUTCDate(), hour = th.getUTCHours();
  const wantDay = Number(cfg.day || 1), wantHour = (cfg.hour != null ? Number(cfg.hour) : 8);
  const nowStr = 'วันที่ ' + day + ' ' + String(hour).padStart(2, '0') + ':00';
  const wantStr = 'วันที่ ' + wantDay + ' ' + String(wantHour).padStart(2, '0') + ':00';
  if (day === wantDay && hour === wantHour) setOut(true, 'ถึงกำหนดส่ง (' + wantStr + ' ไทย)');
  else setOut(false, 'ยังไม่ถึงกำหนด (กำหนด ' + wantStr + ' / ตอนนี้ ' + nowStr + ' ไทย)');
} catch (e) {
  setOut(false, 'เช็กตารางเวลาไม่สำเร็จ: ' + (e && e.message || e));
}
