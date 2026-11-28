import { redirect } from "next/navigation";
import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { getAdminSession } from "@/lib/admin-auth";
import defaults from "@/public/defaults.json";
import ContentEditor from "./content-editor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminContentPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT content_key,content_value FROM cms_content`;
  const values = Object.fromEntries(rows.map((r: any) => [String(r.content_key), String(r.content_value)]));
  const fields = defaults.map(field => ({ key: field.key, section: field.section, label: field.label, type: field.type, value: values[field.key] ?? field.value }));
  const sections = new Set(fields.map(f => f.section));
  return <main className="content-management-page">
    <header className="content-management-header">
      <div className="content-header-brand"><span className="content-brand-mark">S</span><div><strong>Portfolio CMS</strong><small>Signed in as {session.username}</small></div></div>
      <Link href="/admin" className="content-back-link">← Dashboard</Link>
    </header>
    <section className="content-management-wrap">
      <div className="content-hero">
        <div className="content-hero-copy"><span className="content-eyebrow">PORTFOLIO WORKSPACE</span><h1>Manage your content</h1><p>Update the words, links and images that appear on your public portfolio.</p></div>
        <div className="content-hero-badge"><span className="content-live-dot"/> Content connected</div>
      </div>
      <div className="content-summary">
        <div className="content-summary-item"><span className="content-summary-icon">▤</span><div><strong>{fields.length}</strong><small>Content fields</small></div></div>
        <div className="content-summary-item"><span className="content-summary-icon">◫</span><div><strong>{sections.size}</strong><small>Portfolio sections</small></div></div>
        <div className="content-summary-item content-summary-preserved"><span className="content-summary-icon">✓</span><div><strong>Preserved</strong><small>Existing content is safe</small></div></div>
      </div>
      <div className="content-editor-heading"><div><h2>Content library</h2><p>Find a field, edit it, then save only that field.</p></div><Link href="/" target="_blank" className="content-preview-link">Preview website ↗</Link></div>
      <ContentEditor fields={fields}/>
    </section>
  </main>;
}
