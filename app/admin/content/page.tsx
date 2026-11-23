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
  let values:Record<string,string>={};
  if (!process.env.LEGACY_DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const sql=neon(process.env.LEGACY_DATABASE_URL);
  const rows=await sql`SELECT content_key,content_value FROM cms_content`;
  values=Object.fromEntries(rows.map((r:any)=>[String(r.content_key),String(r.content_value)]));
  const fields=defaults.map(field=>({key:field.key,section:field.section,label:field.label,type:field.type,value:values[field.key]??field.value}));
  const sections=new Set(fields.map(f=>f.section));
  return <main style={{minHeight:"100vh",background:"#f5f7fb",fontFamily:"Arial,sans-serif",color:"#1b2940"}}>
    <header style={{background:"#fff",borderBottom:"1px solid #e5ebf3",padding:"17px 4%",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><strong>JS SALMAN</strong><div style={{fontSize:12,color:"#8794a8",marginTop:4}}>Content editor · Signed in as {session.username}</div></div><Link href="/admin" style={{color:"#285db4",fontSize:13,textDecoration:"none"}}>← Back to dashboard</Link></header>
    <section style={{maxWidth:1180,margin:"auto",padding:"32px 22px 60px"}}><div style={{fontSize:11,color:"#6884b3",fontWeight:800,letterSpacing:1.3}}>PORTFOLIO MANAGEMENT</div><h1 style={{fontSize:28,margin:"8px 0"}}>Content editor</h1><p style={{color:"#8190a5",fontSize:13,marginTop:0}}>Edit the text, links and image paths used by your public portfolio. Changes are saved directly to Neon.</p><div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"18px 0 4px"}}><span style={{background:"#fff",border:"1px solid #e6ebf2",padding:"9px 12px",borderRadius:8,fontSize:12}}>{fields.length} fields</span><span style={{background:"#fff",border:"1px solid #e6ebf2",padding:"9px 12px",borderRadius:8,fontSize:12}}>{sections.size} sections</span><span style={{background:"#fff",border:"1px solid #e6ebf2",padding:"9px 12px",borderRadius:8,fontSize:12}}>Existing content preserved</span></div><ContentEditor fields={fields}/></section>
  </main>;
}
