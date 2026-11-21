import { redirect } from "next/navigation";
import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { getAdminSession } from "@/lib/admin-auth";
import CollectionsManager, { type CollectionItem } from "./collections-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminCollectionsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT id,module,title,description,subtitle,image_path,link_url,sort_order,is_published,created_at
    FROM cms_items ORDER BY module ASC,sort_order ASC,id DESC`;
  const items = rows as unknown as CollectionItem[];
  const counts = ["services","portfolio","skills","experience","education"].map(module => ({module,count:items.filter(item=>item.module===module).length}));
  return <main style={{minHeight:"100vh",background:"#f5f7fb",color:"#1b2940",fontFamily:"Arial,sans-serif"}}>
    <header style={{background:"#fff",borderBottom:"1px solid #e5ebf3",padding:"17px 4%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><strong>JS Salman CMS</strong><div style={{fontSize:12,color:"#8794a8",marginTop:4}}>Collections · Signed in as {session.username}</div></div>
      <Link href="/admin" style={{color:"#285db4",fontSize:13,textDecoration:"none"}}>← Back to dashboard</Link>
    </header>
    <section style={{maxWidth:1200,margin:"auto",padding:"32px 22px 60px"}}>
      <div style={{fontSize:11,color:"#6884b3",fontWeight:800,letterSpacing:1.3}}>PORTFOLIO MANAGEMENT</div>
      <h1 style={{fontSize:28,margin:"8px 0"}}>Collections</h1>
      <p style={{color:"#8190a5",fontSize:13,marginTop:0}}>Create, edit, publish or remove portfolio records. Existing database records are loaded below.</p>
      <div style={{display:"flex",gap:9,flexWrap:"wrap",margin:"18px 0"}}>
        {counts.map(c=><span key={c.module} style={{background:"#fff",border:"1px solid #e6ebf2",padding:"9px 12px",borderRadius:8,fontSize:12,textTransform:"capitalize"}}>{c.module}: <strong>{c.count}</strong></span>)}
      </div>
      <CollectionsManager initialItems={items}/>
    </section>
  </main>;
}
