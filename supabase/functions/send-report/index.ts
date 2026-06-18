// ============================================================
//  Edge Function: send-report
//  ส่งอีเมลแนบไฟล์รายงาน PDF ผ่าน SMTP (ผู้เรียกต้องล็อกอินแล้ว)
//  Deploy:  supabase functions deploy send-report
//  ตั้งความลับ SMTP:
//    supabase secrets set SMTP_HOST="smtp.gmail.com" SMTP_PORT="465" \
//      SMTP_USER="you@gmail.com" SMTP_PASS="app-password" SMTP_FROM="you@gmail.com"
// ============================================================
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // ---- ตรวจว่าเป็นผู้ล็อกอิน ----
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const ures = await fetch(url + "/auth/v1/user", { headers: { Authorization: "Bearer " + token, apikey: anon } });
    if (!ures.ok) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { to, subject, filename, pdfBase64, message } = body;
    if (!to || !pdfBase64) return json({ error: "ต้องระบุอีเมลผู้รับและไฟล์ PDF" }, 400);
    const recipients = String(to).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (!recipients.length) return json({ error: "ไม่มีอีเมลผู้รับ" }, 400);

    const host = Deno.env.get("SMTP_HOST");
    const port = Number(Deno.env.get("SMTP_PORT") || "465");
    const username = Deno.env.get("SMTP_USER");
    const password = Deno.env.get("SMTP_PASS");
    const from = Deno.env.get("SMTP_FROM") || username;
    if (!host || !username || !password) {
      return json({ error: "ยังไม่ได้ตั้งค่า SMTP — ตั้ง secrets SMTP_HOST / SMTP_USER / SMTP_PASS (ดู SEND-EMAIL.md)" }, 500);
    }

    const client = new SMTPClient({
      connection: { hostname: host, port, tls: port === 465, auth: { username, password } },
    });
    await client.send({
      from: from!,
      to: recipients,
      subject: subject || "รายงานประเมินเจ้าหน้าที่ Onsite Support",
      content: (message || "แนบรายงาน PDF") + "",
      html: '<div style="font-family:Tahoma,sans-serif;white-space:pre-line;font-size:14px;color:#1f2937">' +
        String(message || "แนบรายงาน PDF").replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</div>",
      attachments: [{ filename: filename || "report.pdf", encoding: "base64", content: pdfBase64, contentType: "application/pdf" }],
    });
    await client.close();
    return json({ ok: true, sent: recipients.length });
  } catch (e) {
    return json({ error: "ส่งอีเมลไม่สำเร็จ: " + String((e as any)?.message || e) }, 500);
  }
});
