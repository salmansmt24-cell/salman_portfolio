import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (token.length < 40 || token.length > 200 || password.length < 12 || password.length > 72) {
    return NextResponse.json({ error: "The reset link or password is invalid. Use a password of 12–72 characters." }, { status: 400 });
  }

  const connection = process.env.LEGACY_DATABASE_URL;
  if (!connection) return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 });

  try {
    const sql = neon(connection);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const claimed = await sql`DELETE FROM admin_password_reset_tokens
      WHERE token_hash = ${tokenHash} AND username = 'Salman' AND expires_at > NOW()
      RETURNING username`;
    if (!claimed.length) {
      return NextResponse.json({ error: "This reset link is invalid or expired. Request a new reset link." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await sql`UPDATE cms_admins SET password_hash = ${passwordHash}
      WHERE BTRIM(username) = 'Salman' RETURNING id`;
    if (!updated.length) {
      return NextResponse.json({ error: "Admin account was not found. Contact support." }, { status: 404 });
    }
    await sql`UPDATE admin_security_sessions SET revoked_at = NOW()
      WHERE BTRIM(username) = 'Salman' AND revoked_at IS NULL`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin password reset failed:", error);
    return NextResponse.json({ error: "Password reset failed. Please try again or contact support." }, { status: 500 });
  }
}
