import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const COOKIE = "salman_admin_session";
const TTL_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  return value;
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function createSession(username: string) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now()/1000)+TTL_SECONDS })).toString("base64url");
  return payload + "." + sign(payload);
}
export function verifySession(token?: string | null) {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {sub?:string;exp?:number};
    if (!data.sub || !data.exp || data.exp < Math.floor(Date.now()/1000)) return null;
    return { username: data.sub };
  } catch { return null; }
}
export async function getAdminSession() {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
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
  // Confirm which database the Preview runtime is actually reaching.
  const [dbInfo] = await sql`SELECT current_database() AS database_name,
    current_schema() AS schema_name,
    current_user AS database_user,
    to_regprocedure('public.crypt(text,text)')::text AS crypt_function`;
  if (!dbInfo?.crypt_function) {
    throw new Error("Admin DB diagnostic: " + JSON.stringify(dbInfo ?? { diagnostic: "no database response" }));
  }
  // Verify the password with PostgreSQL pgcrypto itself.
  const rows = await sql`SELECT 1 AS matched
    FROM cms_admins
    WHERE TRIM(username) = ${username}
      AND password_hash::text = public.crypt(${password}::text, password_hash::text)
    LIMIT 1`;
  return rows.length > 0;
}
export const ADMIN_COOKIE_NAME = COOKIE;
