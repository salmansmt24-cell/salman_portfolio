import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

const COOKIE = "toolnest_user_session";
const TTL = 60 * 60 * 24 * 14;
const db = () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
};
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const sql = db();
  await sql`INSERT INTO app_user_sessions (user_id, token_hash, expires_at) VALUES (${userId}, ${hash(token)}, NOW() + INTERVAL '14 days')`;
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL });
}
export async function getUserSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const sql = db();
  const rows = await sql`SELECT u.id, u.email, u.username, u.role, u.status
    FROM app_user_sessions s JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash(token)} AND s.expires_at > NOW() AND u.status = 'active' LIMIT 1`;
  if (!rows.length) return null;
  await sql`UPDATE app_user_sessions SET last_seen_at = NOW() WHERE token_hash = ${hash(token)}`;
  return rows[0] as {id:string;email:string;username:string;role:string;status:string};
}
export async function clearUserSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db()`DELETE FROM app_user_sessions WHERE token_hash = ${hash(token)}`;
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export { db as userDb };
