import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const COOKIE = "bms_team_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;
export function bmsDb() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return neon(process.env.DATABASE_URL);
}
export function hashBmsToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function newBmsToken() {
  return randomBytes(32).toString("base64url");
}
export async function hashBmsPassword(password: string) {
  return bcrypt.hash(password, 12);
}
export async function verifyBmsPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
export async function setBmsCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_SECONDS });
}
export async function clearBmsCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export async function getBmsSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const sql = bmsDb();
    const rows = await sql`SELECT m.id AS member_id,m.full_name,m.email,m.role,m.status
      FROM bms_user_sessions s JOIN bms_team_members m ON m.id=s.member_id
      WHERE s.session_token_hash=${hashBmsToken(token)} AND s.revoked_at IS NULL
      AND s.expires_at>NOW() AND m.status='active' LIMIT 1`;
    if (!rows.length) return null;
    await sql`UPDATE bms_user_sessions SET last_seen_at=NOW()
      WHERE session_token_hash=${hashBmsToken(token)} AND last_seen_at<NOW()-INTERVAL '5 minutes'`;
    const m = rows[0];
    return { memberId: Number(m.member_id), fullName: String(m.full_name), email: String(m.email), role: String(m.role) };
  } catch (error) {
    console.error("BMS session validation failed:", error);
    return null;
  }
}
export const BMS_COOKIE_NAME = COOKIE;
export const BMS_SESSION_TTL_SECONDS = TTL_SECONDS;
