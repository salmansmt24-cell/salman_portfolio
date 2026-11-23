import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUserSession, userDb } from "@/lib/user-auth";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = String(body.email ?? "").trim().toLowerCase(), password = String(body.password ?? "");
  if (!email || !password || password.length > 72) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  try {
    const rows = await userDb()`SELECT id, password_hash, status FROM app_users WHERE LOWER(email) = ${email} LIMIT 1`;
    const row = rows[0];
    const valid = row ? await bcrypt.compare(password, String(row.password_hash)) : false;
    if (!valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    if (row.status !== "active") return NextResponse.json({ error: row.status === "suspended" ? "This account is suspended. Contact support." : "Your registration is awaiting approval." }, { status: 403 });
    await createUserSession(String(row.id));
    return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  } catch (error) {
    console.error("ToolNest login error:", error);
    return NextResponse.json({ error: "Login is not available yet. Please try again later." }, { status: 503 });
  }
}
