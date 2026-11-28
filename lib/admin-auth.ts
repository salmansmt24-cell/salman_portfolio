import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { tokenHash } from "@/lib/admin-security";

const COOKIE = "salman_admin_session";
const TTL_SECONDS = 60 * 60 * 12;
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  return value;
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function createSession(username: string) {
  const payload = Buffer.from(JSON.stringify({ sub: username, sid: randomUUID(), exp: Math.floor(Date.now()/1000)+TTL_SECONDS })).toString("base64url");
  return payload + "." + sign(payload);
}
export async function registerAdminSession(username: string, token: string, headers: Headers) {
  const { securitySql, requestIp, deviceLabel } = await import("@/lib/admin-security");
  const sql = securitySql();
  const [payload] = token.split(".");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {sid:string;exp:number};
  const ua = (headers.get("user-agent") || "").slice(0,1000);
  await sql`INSERT INTO admin_security_sessions (id,username,session_token_hash,device_label,user_agent,ip_address,expires_at)
    VALUES (${data.sid},${username},${tokenHash(token)},${deviceLabel(ua)},${ua},${requestIp(headers)},to_timestamp(${data.exp}))`;
}
export function verifySession(token?: string | null) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {sub?:string;sid?:string;exp?:number};
    if (!data.sub || !data.sid || !data.exp || data.exp < Math.floor(Date.now()/1000)) return null;
    return { username: data.sub, sessionId: data.sid };
  } catch { return null; }
}
export async function getAdminSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const verified = verifySession(token);
  if (!verified || !token) return null;
  try {
    const sql = neon(process.env.DATABASE_URL || "");
    const rows = await sql`SELECT id FROM admin_security_sessions
      WHERE id=${verified.sessionId} AND username=${verified.username}
      AND session_token_hash=${tokenHash(token)} AND revoked_at IS NULL AND expires_at>NOW()
      LIMIT 1`;
    if (!rows.length) return null;
    await sql`UPDATE admin_security_sessions SET last_seen_at=NOW()
      WHERE id=${verified.sessionId} AND last_seen_at < NOW()-INTERVAL '5 minutes'`;
    return verified;
  } catch (error) {
    console.error("Admin session validation failed:", error);
    return null;
  }
}
export async function setAdminCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax", path:"/", maxAge:TTL_SECONDS });
}
export async function clearAdminCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax", path:"/", maxAge:0 });
}
export async function verifyAdminPassword(username: string, password: string) {
  const { neon } = await import("@neondatabase/serverless");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT password_hash FROM cms_admins WHERE TRIM(username) = ${username} LIMIT 1`;
  const storedHash = String(rows[0]?.password_hash ?? "").trim();
  if (!storedHash) return false;
  return bcrypt.compare(password, storedHash.replace(/^\\$2y\\$/, "$2b$"));
}
export const ADMIN_COOKIE_NAME = COOKIE;
