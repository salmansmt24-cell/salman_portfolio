import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userDb } from "@/lib/user-auth";

export const runtime = "nodejs";
const reserved = new Set(["admin","api","www","dashboard","login","register","support","mail","ftp","assets","static","help","billing","settings","toolnest"]);
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  let body: { email?: string; username?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(username) || reserved.has(username)) return NextResponse.json({ error: "Choose a valid username (3–30 letters, numbers or hyphens). This username may become your portfolio address." }, { status: 400 });
  if (password.length < 10 || password.length > 72) return NextResponse.json({ error: "Password must be 10–72 characters." }, { status: 400 });
  try {
    const sql = userDb();
    const exists = await sql`SELECT 1 FROM app_users WHERE LOWER(email) = ${email} OR LOWER(username) = ${username} LIMIT 1`;
    if (exists.length) return NextResponse.json({ error: "Email or username is already registered." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql`INSERT INTO app_users (email, username, password_hash, status) VALUES (${email}, ${username}, ${passwordHash}, 'pending') RETURNING id`;
    const userId = String(rows[0].id);
    await sql`INSERT INTO app_user_profiles (user_id, display_name) VALUES (${userId}, ${username})`;
    await sql`INSERT INTO portfolio_sites (user_id, slug, title) VALUES (${userId}, ${username}, ${username} || ' — Portfolio')`;
    await sql`INSERT INTO portfolio_audit_events (target_user_id, event_type) VALUES (${userId}, 'registration_submitted')`;
    return NextResponse.json({ ok: true, message: "Registration received. Your account is pending approval before you can sign in." }, { status: 201 });
  } catch (error) {
    console.error("ToolNest registration error:", error);
    return NextResponse.json({ error: "Registration is not available yet. Please try again later." }, { status: 503 });
  }
}
