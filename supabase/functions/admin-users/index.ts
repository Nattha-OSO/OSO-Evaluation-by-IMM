// ============================================================
//  Edge Function: admin-users
//  จัดการบัญชีผู้ใช้ระบบ (เฉพาะ admin) ด้วย service_role
//  actions: whoami | list | create | updateRole | delete
//  Deploy:  supabase functions deploy admin-users
//  ตั้งความลับ:  supabase secrets set ADMIN_EMAILS="you@example.com"
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

    // ---- ตรวจสอบผู้เรียก ----
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: ures, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !ures?.user) return json({ error: "unauthorized" }, 401);
    const caller = ures.user;
    const role = (caller.app_metadata && (caller.app_metadata as any).role) || "";
    const bootstrap = (Deno.env.get("ADMIN_EMAILS") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const isAdmin = role === "admin" || bootstrap.includes((caller.email || "").toLowerCase());

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "whoami") {
      return json({ isAdmin, role: isAdmin ? "admin" : (role || "senior"), email: caller.email });
    }
    if (!isAdmin) return json({ error: "forbidden: admin only" }, 403);

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const users = data.users.map((u) => ({
        id: u.id, email: u.email,
        role: (u.app_metadata && (u.app_metadata as any).role) || "senior",
        created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
      }));
      return json({ users });
    }
    if (action === "create") {
      const { email, password, role: r } = body;
      if (!email || !password || String(password).length < 6) return json({ error: "ต้องมี email และรหัสผ่านอย่างน้อย 6 ตัว" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, app_metadata: { role: r || "senior" },
      });
      if (error) throw error;
      return json({ user: { id: data.user.id, email: data.user.email } });
    }
    if (action === "updateRole") {
      const { id, role: r } = body;
      if (!id || !["admin", "senior", "manager"].includes(r)) return json({ error: "ข้อมูลไม่ถูกต้อง" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { app_metadata: { role: r } });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "missing id" }, 400);
      if (id === caller.id) return json({ error: "ลบบัญชีตัวเองไม่ได้" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
