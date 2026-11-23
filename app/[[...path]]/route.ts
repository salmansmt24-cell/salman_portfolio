import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function validValue(value: string, type: string, fallback: string) {
  if (type === "image") return (/^(assets\\/images\\/|uploads\\/)[a-zA-Z0-9_./-]+$/.test(value) || /^api\\/media\\/[0-9]+$/.test(value)) && !value.includes("..") ? value : fallback;
  if (type === "url") {
    if (value.startsWith("mailto:")) return value;
    try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) ? value : fallback; } catch { return fallback; }
  }
  return value;
}

export async function GET() {
  const [template, defaultsRaw] = await Promise.all([
    readFile(path.join(process.cwd(), "public/template.html"), "utf8"),
    readFile(path.join(process.cwd(), "public/defaults.json"), "utf8"),
  ]);
  const defaults = JSON.parse(defaultsRaw) as Array<{key:string; value:string; type?:string}>;
  const byKey = new Map(defaults.map((x) => [x.key, x]));
  let values: Record<string,string> = {};
  let collections: Array<{module:string; title:string; description:string; subtitle:string; image_path:string; link_url:string}> = [];
  if (process.env.LEGACY_DATABASE_URL) {
    const sql = neon(process.env.LEGACY_DATABASE_URL);
    try {
      const rows = await sql`SELECT content_key, content_value FROM cms_content`;
      values = Object.fromEntries(rows.map((r:any) => [r.content_key, r.content_value]));
      collections = await sql`SELECT module,title,description,subtitle,image_path,link_url FROM cms_items WHERE is_published = TRUE ORDER BY sort_order,id` as any;
    } catch (error) {
      console.error("Portfolio database read failed", error);
    }
  }
  let html = template.replace(/\{\{CMS:([a-zA-Z0-9_-]+)\}\}/g, (_match, key:string) => {
    const entry = byKey.get(key); if (!entry) return "";
    const value = String(values[key] ?? entry.value ?? "");
    return esc(validValue(value, entry.type ?? "text", String(entry.value ?? "")));
  });
  const grouped = new Map<string, typeof collections>();
  for (const row of collections) grouped.set(row.module, [...(grouped.get(row.module) ?? []), row]);
  for (const module of ["services","portfolio","testimonials","faq","skills","experience","education"]) {
    const rows = grouped.get(module); if (!rows?.length) continue;
    const cards = rows.map((r) => {
      const image = r.image_path && (/^(assets\\/images\\/|uploads\\/)[a-zA-Z0-9_./-]+$/.test(r.image_path) || /^api\\/media\\/[0-9]+$/.test(r.image_path)) && !r.image_path.includes("..") ? `<img loading="lazy" style="max-width:100%;height:160px;object-fit:cover;border-radius:12px;margin-bottom:12px" src="/${esc(r.image_path)}" alt="${esc(r.title)}">` : "";
      const link = r.link_url ? (() => { try { const u = new URL(r.link_url); return ["http:","https:"].includes(u.protocol) ? `<p><a style="color:#4179ff" target="_blank" rel="noopener noreferrer" href="${esc(r.link_url)}">View details ↗</a></p>` : ""; } catch { return ""; } })() : "";
      return `<article style="background:#fff;color:#152743;padding:24px;border:1px solid #dce7f4;border-radius:18px;box-shadow:0 8px 25px #102e5210;min-width:0">${image}<small style="color:#5874a3">${esc(r.subtitle)}</small><h3 style="font-size:20px;margin:10px 0">${esc(r.title)}</h3><p style="color:#536782;line-height:1.7">${esc(r.description).replace(/\n/g,"<br>")}</p>${link}</article>`;
    }).join("");
    const block = `<div class="container" style="margin-top:36px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:20px">${cards}</div></div>`;
    const pattern = new RegExp(`(<section\\b[^>]*\\bid=["']${module}["'][^>]*>[\\s\\S]*?)(</section>)`,"i");
    html = html.replace(pattern, (_m, a, b) => a + block + b);
  }
  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8", "x-content-type-options":"nosniff", "content-security-policy":"frame-ancestors 'self'", "cache-control":"no-store" } });
}


export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== "/contact-submit.php" && requestUrl.pathname !== "/contact-submit") {
    return new Response("Not found", { status: 404 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { if (new URL(origin).host !== host) return new Response("Request rejected", { status: 403 }); }
    catch { return new Response("Request rejected", { status: 403 }); }
  }
  const redirectTo = (status: string) => Response.redirect(new URL("/?contact=" + status + "#contact", requestUrl.origin), 303);
  try {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const service = String(form.get("service") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const honeypot = String(form.get("website") ?? "").trim();
    if (honeypot) return redirectTo("success");
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !service || service.length > 120 || !message || message.length > 5000) return redirectTo("invalid");
    if (!process.env.LEGACY_DATABASE_URL) {
      console.error("Contact form failed: LEGACY_DATABASE_URL is not configured");
      return redirectTo("error");
    }
    const sql = neon(process.env.LEGACY_DATABASE_URL);
    await sql`INSERT INTO cms_messages (name,email,service,message) VALUES (${name},${email},${service},${message})`;
    return redirectTo("success");
  } catch (error) {
    console.error("Contact form submission failed", error);
    return redirectTo("error");
  }
}
