import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return NextResponse.json({ error: "Request rejected." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Request rejected." }, { status: 403 }); }
  }
  let body: { token?: string; password?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (token.length !== 64 || password.length < 12 || password.length > 72) {
    return NextResponse.json({ error: "The reset link or password is invalid. Use a password of 12–72 characters." }, { status: 400 });
  }

  const expectedHash = process.env.ADMIN_PASSWORD_RESET_TOKEN_HASH;
  const expiresAt = Date.parse(process.env.ADMIN_PASSWORD_RESET_EXPIRES_AT ?? "");
  const connection = process.env.DATABASE_URL;
  if (!expectedHash || !Number.isFinite(expiresAt) || Date.now() > expiresAt || !connection) return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 });

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const a = Buffer.from(tokenHash, "hex"), b = Buffer.from(expectedHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    }

    const sql = neon(connection);
    const claimed = await sql`INSERT INTO admin_password_reset_tokens (token_hash, username, expires_at)
      VALUES (${tokenHash}, 'Salman', NOW())
      ON CONFLICT (token_hash) DO NOTHING
      RETURNING token_hash`;
    if (!claimed.length) return NextResponse.json({ error: "This reset link has already been used." }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await sql`UPDATE cms_admins SET password_hash = ${passwordHash}
      WHERE BTRIM(username) = 'Salman' RETURNING id`;
    if (!updated.length) return NextResponse.json({ error: "Admin account was not found. Contact support." }, { status: 404 });
    await sql`UPDATE admin_security_sessions SET revoked_at = NOW()
      WHERE BTRIM(username) = 'Salman' AND revoked_at IS NULL`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin password reset failed:", error);
    return NextResponse.json({ error: "Password reset failed. Please try again or contact support." }, { status: 500 });
  }
}
