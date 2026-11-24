import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getAdminSession } from "@/lib/admin-auth";
import defaults from "@/public/defaults.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = new Map(defaults.map((item) => [item.key, item]));

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Request rejected" }, { status: 403 });

  let body: { key?: unknown; value?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const key = typeof body.key === "string" ? body.key : "";
  const value = typeof body.value === "string" ? body.value : "";
  const field = allowed.get(key);
  if (!field) return NextResponse.json({ error: "Unknown content field" }, { status: 400 });
  if (value.length > 20000) return NextResponse.json({ error: "Value is too long" }, { status: 400 });
  if (field.type === "url" && value) {
    try { const u = new URL(value); if (!["http:","https:","mailto:"].includes(u.protocol)) throw new Error(); }
    catch { return NextResponse.json({ error: "Enter a valid http, https or mailto URL" }, { status: 400 }); }
  }
  if (field.type === "image" && value && (!/^(assets\/images\/|uploads\/|api\/media\/)[a-zA-Z0-9_./-]+$/.test(value) || value.includes(".."))) {
    return NextResponse.json({ error: "Use a valid path inside assets/images or uploads" }, { status: 400 });
  }
  if (!process.env.LEGACY_DATABASE_URL) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  try {
    const sql = neon(process.env.LEGACY_DATABASE_URL);
    await sql`INSERT INTO cms_content (content_key, content_value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = NOW()`;
    return NextResponse.json({ ok: true, key });
  } catch (error) {
    console.error("Content save failed", error);
    return NextResponse.json({ error: "Could not save this field" }, { status: 500 });
  }
}
