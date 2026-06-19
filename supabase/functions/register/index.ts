// ============================================================
//  Edge Function: register  (สาธารณะ — ไม่ต้องล็อกอิน)
//  รับคำขอลงทะเบียน -> สร้างบัญชีสถานะ "รออนุมัติ" (ไม่มี role ใน app_metadata)
//  + บันทึกลงตาราง access_requests ให้ admin พิจารณา
//  ผู้ใช้จะเข้าระบบได้ก็ต่อเมื่อ admin กำหนดสิทธิ์ (role) ให้แล้วเท่านั้น
//  Deploy:  supabase functions deploy register --no-verify-jwt
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    let { email, password, full_name, reason } = body as any;
    email = String(email || "").normalize("NFKC").replace(/[^\x21-\x7E]/g, "").toLowerCase();
    full_name = String(full_name || "").trim();
    reason = String(reason || "").trim();

    if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email)) return json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, 400);
    if (!password || String(password).length < 6) return json({ error: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" }, 400);
    if (!full_name) return json({ error: "กรุณากรอกชื่อ-นามสกุล" }, 400);

    // สร้างบัญชีแบบยืนยันอีเมลแล้ว (ไม่ต้องส่งเมลยืนยัน) แต่ "ไม่มี role" = ยังเข้าระบบไม่ได้จนกว่าจะอนุมัติ
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, reason },
    });
    if (error) {
      const m = String((error as any)?.message || "");
      if (/registered|already|exist/i.test(m)) return json({ error: "อีเมลนี้มีบัญชี/ยื่นคำขอไว้แล้ว — หากรออนุมัติอยู่ โปรดรอผู้ดูแลระบบ" }, 400);
      return json({ error: m || "สร้างคำขอไม่สำเร็จ" }, 400);
    }

    // บันทึกคำขอให้ admin เห็น (service role -> ข้าม RLS)
    const { error: ierr } = await admin.from("access_requests").insert({
      email, full_name, reason: reason || null, status: "pending",
    });
    if (ierr) console.error("insert access_requests:", ierr.message);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
