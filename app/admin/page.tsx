import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  let counts = { content:0, orders:0, profiles:0, messages:0, templates:0 };
  let dbStatus = "Unavailable";
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT
      (SELECT COUNT(*)::int FROM cms_content) AS content,
      (SELECT COUNT(*)::int FROM cms_fiverr_orders) AS orders,
      (SELECT COUNT(*)::int FROM cms_fiverr_profiles) AS profiles,
      (SELECT COUNT(*)::int FROM cms_messages) AS messages,
      (SELECT COUNT(*)::int FROM cms_private_templates) AS templates`;
    counts = rows[0] as typeof counts; dbStatus = "Connected";
  } catch (error) { console.error("Admin dashboard database read failed:",error); }
  const cards = [["Content fields",counts.content],["Fiverr orders",counts.orders],["Fiverr profiles",counts.profiles],["Contact messages",counts.messages],["Saved templates",counts.templates]];
  return <main style={{minHeight:"100vh",background:"#f4f7fb",fontFamily:"Arial,sans-serif",color:"#1d2b43"}}>
    <header style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"18px 5%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:20}}>
      <div><strong style={{fontSize:20}}>JS Salman CMS</strong><div style={{fontSize:13,color:"#718096",marginTop:4}}>Signed in as {session.username}</div></div>
      <form action="/api/admin/logout" method="post"><button style={{padding:"10px 16px",border:"1px solid #d7e0eb",borderRadius:9,background:"#fff",cursor:"pointer"}}>Sign out</button></form>
    </header>
    <section style={{maxWidth:1180,margin:"0 auto",padding:"42px 24px"}}>
      <h1 style={{fontSize:30,margin:"0 0 8px"}}>Dashboard</h1>
      <p style={{color:"#718096",margin:"0 0 28px"}}>Your migrated portfolio database overview.</p>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,fontSize:13}}><span style={{width:9,height:9,borderRadius:20,background:dbStatus==="Connected"?"#16a34a":"#dc2626"}}/>Database: {dbStatus}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
        {cards.map(([label,value])=><article key={label} style={{background:"#fff",border:"1px solid #e4eaf2",borderRadius:14,padding:22}}><div style={{fontSize:14,color:"#718096"}}>{label}</div><div style={{fontSize:32,fontWeight:700,marginTop:10}}>{value}</div></article>)}
      </div>
      <h2 style={{fontSize:20,margin:"36px 0 14px"}}>Management modules</h2>
      <div style={{background:"#fff",border:"1px solid #e4eaf2",borderRadius:14,padding:22,lineHeight:1.8}}>
        <p style={{marginTop:0}}>Authentication and dashboard foundation is installed. The following modules are next to migrate and are not yet editable here:</p>
        <ul><li>Portfolio content editor and section CRUD</li><li>Services, portfolio items, skills, experience and education</li><li>Contact messages</li><li>Fiverr orders, profiles and reporting</li><li>Private templates and media library</li><li>Analytics, insights and Google Sheets sync</li></ul>
        <Link href="/" style={{color:"#2459a6"}}>View public portfolio ↗</Link>
      </div>
    </section>
  </main>;
}
