import { redirect } from "next/navigation";
import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { getAdminSession } from "@/lib/admin-auth";
import CollectionsManager, { type CollectionItem } from "./collections-manager";
export const dynamic = "force-dynamic";export const runtime = "nodejs";
export default async function AdminCollectionsPage() {
 const session=await getAdminSession();if(!session)redirect("/admin/login");
 if(!process.env.LEGACY_DATABASE_URL)throw new Error("DATABASE_URL is not configured");
 const sql=neon(process.env.LEGACY_DATABASE_URL);
 const rows=await sql`SELECT id,module,title,description,subtitle,image_path,link_url,sort_order,is_published,created_at FROM cms_items ORDER BY module ASC,sort_order ASC,id DESC`;
 const items=rows as unknown as CollectionItem[];
 const counts=["services","portfolio","testimonials","faq","skills","experience","education"].map(module=>({module,count:items.filter(item=>item.module===module).length}));
 const published=items.filter(item=>item.is_published).length;
 return <main className="content-management-page">
  <header className="content-management-header"><div className="content-header-brand"><span className="content-brand-mark">S</span><div><strong>Portfolio CMS</strong><small>Collections · Signed in as {session.username}</small></div></div><Link href="/admin" className="content-back-link">← Dashboard</Link></header>
  <section className="content-management-wrap">
   <div className="content-hero"><div className="content-hero-copy"><span className="content-eyebrow">PORTFOLIO MANAGEMENT</span><h1>Portfolio collections</h1><p>Create, edit, publish or remove the records displayed across your public portfolio.</p></div><div className="content-hero-badge"><span className="content-live-dot"/> Database connected</div></div>
   <div className="content-summary"><div className="content-summary-item"><span className="content-summary-icon">▦</span><div><strong>{items.length}</strong><small>Total records</small></div></div><div className="content-summary-item"><span className="content-summary-icon">◉</span><div><strong>{published}</strong><small>Published records</small></div></div><div className="content-summary-item"><span className="content-summary-icon">▤</span><div><strong>{counts.length}</strong><small>Content categories</small></div></div></div>
   <div className="content-editor-heading"><div><h2>Collection library</h2><p>Choose a category to organize your portfolio content.</p></div></div>
   <div className="content-category-chips">{counts.map(c=><span key={c.module} className="content-category-chip">{c.module}<strong>{c.count}</strong></span>)}</div>
   <CollectionsManager initialItems={items}/>
  </section>
 </main>;
}
