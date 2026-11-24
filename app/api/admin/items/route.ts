import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULES = new Set(["services", "portfolio", "testimonials", "faq", "skills", "experience", "education"]);
type ItemInput = {
  module?: unknown; title?: unknown; description?: unknown; subtitle?: unknown;
  image_path?: unknown; link_url?: unknown; sort_order?: unknown; is_published?: unknown;
};

function validModule(value: unknown): value is string {
  return typeof value === "string" && MODULES.has(value);
}
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length <= max ? v : null;
}
function validUrl(value: string): boolean {
  if (!value) return true;
  try { const u = new URL(value); return ["http:", "https:", "mailto:"].includes(u.protocol); }
  catch { return false; }
}
function db() {
  if (!process.env.LEGACY_DATABASE_URL) throw new Error("Database is not configured");
  return neon(process.env.LEGACY_DATABASE_URL);
}
async function authorized(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return false; }
    catch { return false; }
  }
  return true;
}
function parseItem(body: ItemInput) {
  const module = body.module;
  const title = cleanText(body.title, 255);
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const subtitle = cleanText(body.subtitle ?? "", 255);
  const image_path = cleanText(body.image_path ?? "", 500);
  const link_url = cleanText(body.link_url ?? "", 500);
  const sort_order = Number(body.sort_order ?? 0);
  const is_published = body.is_published === undefined ? true : body.is_published;
  if (!validModule(module)) return { error: "Choose a valid collection." } as const;
  if (!title) return { error: "Title is required and must be under 255 characters." } as const;
  if (description === null || description.length > 20000) return { error: "Description is required and must be under 20,000 characters." } as const;
  if (subtitle === null || image_path === null || link_url === null) return { error: "One of the fields is too long." } as const;
  if (!validUrl(link_url)) return { error: "Link must be a valid http, https or mailto URL." } as const;
  if (image_path && (!/^(assets\/images\/|uploads\/|api\/media\/)[a-zA-Z0-9_./-]+$/.test(image_path) || image_path.includes(".."))) return { error: "Image path must be inside assets/images or uploads." } as const;
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 100000) return { error: "Sort order must be a number from 0 to 100000." } as const;
  if (typeof is_published !== "boolean") return { error: "Publish status is invalid." } as const;
  return { value: { module, title, description, subtitle, image_path, link_url, sort_order, is_published } } as const;
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized or request rejected" }, { status: 403 });
  let body: ItemInput;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = parseItem(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const sql = db();
    const rows = await sql`INSERT INTO cms_items (module,title,description,subtitle,image_path,link_url,sort_order,is_published)
      VALUES (${parsed.value.module},${parsed.value.title},${parsed.value.description},${parsed.value.subtitle},${parsed.value.image_path},${parsed.value.link_url},${parsed.value.sort_order},${parsed.value.is_published})
      RETURNING id,module,title,description,subtitle,image_path,link_url,sort_order,is_published,created_at`;
    return NextResponse.json({ ok: true, item: rows[0] });
  } catch (error) { console.error("Collection create failed", error); return NextResponse.json({ error: "Could not create item." }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized or request rejected" }, { status: 403 });
  let body: ItemInput & { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  const parsed = parseItem(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const sql = db();
    const rows = await sql`UPDATE cms_items SET title=${parsed.value.title},description=${parsed.value.description},subtitle=${parsed.value.subtitle},
      image_path=${parsed.value.image_path},link_url=${parsed.value.link_url},sort_order=${parsed.value.sort_order},
      is_published=${parsed.value.is_published},module=${parsed.value.module}
      WHERE id=${id} RETURNING id,module,title,description,subtitle,image_path,link_url,sort_order,is_published,created_at`;
    if (!rows.length) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    return NextResponse.json({ ok: true, item: rows[0] });
  } catch (error) { console.error("Collection update failed", error); return NextResponse.json({ error: "Could not update item." }, { status: 500 }); }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized or request rejected" }, { status: 403 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  try {
    const sql = db();
    const rows = await sql`DELETE FROM cms_items WHERE id=${id} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (error) { console.error("Collection delete failed", error); return NextResponse.json({ error: "Could not delete item." }, { status: 500 }); }
}
