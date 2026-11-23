import { createHash, createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { neon } from "@neondatabase/serverless";

export function securitySql() {
  if (!process.env.LEGACY_DATABASE_URL) throw new Error("LEGACY_DATABASE_URL is not configured.");
  return neon(process.env.LEGACY_DATABASE_URL);
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function requestIp(headers: Headers) {
  const raw = (headers.get("x-real-ip") || headers.get("x-vercel-forwarded-for") || "").split(",")[0].trim();
  return isIP(raw) ? raw : null;
}
export function deviceLabel(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`.slice(0, 240);
}
export async function recordSecurityEvent(username: string, eventType: string, headers: Headers, details: Record<string, unknown> = {}) {
  const sql = securitySql();
  const ip = requestIp(headers);
  const ua = (headers.get("user-agent") || "").slice(0, 1000);
  await sql`INSERT INTO admin_security_login_events (username,event_type,user_agent,ip_address,details_json)
    VALUES (${username},${eventType},${ua},${ip},${JSON.stringify(details)}::jsonb)`;
  await sql`INSERT INTO admin_security_audit_log (username,action,details_json,ip_address,user_agent)
    VALUES (${username},${eventType},${JSON.stringify(details)}::jsonb,${ip},${ua})`;
}
function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function newTotpSecret() {
  const bytes = randomBytes(20);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}
export function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 30000);
  for (const drift of [-1, 0, 1]) {
    const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter + drift));
    const digest = createHmac("sha1", key).update(msg).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
    if (String(binary % 1000000).padStart(6, "0") === code) return true;
  }
  return false;
}
function encryptionKey() {
  const raw = process.env.ADMIN_TOTP_ENCRYPTION_KEY || "";
  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ADMIN_TOTP_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.");
  return key;
}
export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptTotpSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted TOTP secret.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
