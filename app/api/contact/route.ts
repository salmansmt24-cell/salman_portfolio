import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(req: NextRequest, status: "sent" | "error") {
  return NextResponse.redirect(new URL("/?contact=" + status + "#contact", req.url), 303);
}
function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 100);
}
async function allowSubmission(sql: ReturnType<typeof neon>, ip: string) {
  await sql`CREATE TABLE IF NOT EXISTS cms_public_rate_limits (
    key_hash CHAR(64) NOT NULL, kind VARCHAR(20) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(), request_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(key_hash, kind)
  )`;
  const hash = createHash("sha256").update((process.env.ADMIN_SESSION_SECRET || "contact-rate-limit") + ":" + ip).digest("hex");
  const rows = await sql`INSERT INTO cms_public_rate_limits(key_hash,kind,window_start,request_count)
    VALUES(${hash},'contact',NOW(),1)
    ON CONFLICT(key_hash,kind) DO UPDATE SET
      window_start=CASE WHEN cms_public_rate_limits.window_start<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE cms_public_rate_limits.window_start END,
      request_count=CASE WHEN cms_public_rate_limits.window_start<NOW()-INTERVAL '15 minutes' THEN 1 ELSE cms_public_rate_limits.request_count+1 END
    RETURNING request_count`;
  return Number(rows[0]?.request_count || 0) <= 5;
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== req.headers.get("host")) return redirect(req, "error"); }
    catch { return redirect(req, "error"); }
  }
  try {
    const data = await req.formData();
    // Honeypot: silently accept bot submissions without storing them.
    if (String(data.get("website") || "").trim()) return redirect(req, "sent");
    const name = String(data.get("name") || "").trim().slice(0, 120);
    const email = String(data.get("email") || "").trim().slice(0, 254).toLowerCase();
    const service = String(data.get("service") || "").trim().slice(0, 120);
    const message = String(data.get("message") || "").trim().slice(0, 5000);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !service || !message || message.length < 10) return redirect(req, "error");
    if (!process.env.DATABASE_URL) return redirect(req, "error");
    const sql = neon(process.env.DATABASE_URL);
    if (!(await allowSubmission(sql, clientIp(req)))) return redirect(req, "error");
    await sql`INSERT INTO cms_messages(id,name,email,service,message,is_read,created_at)
      VALUES(nextval('cms_messages_id_seq'),${name},${email},${service},${message},FALSE,NOW())`;
    return redirect(req, "sent");
  } catch (error) {
    console.error("Contact form submission failed:", error);
    return redirect(req, "error");
  }
}
