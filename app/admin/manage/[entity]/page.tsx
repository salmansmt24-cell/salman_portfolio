import {notFound,redirect} from "next/navigation";
import Link from "next/link";
import {neon} from "@neondatabase/serverless";
import {getAdminSession} from "@/lib/admin-auth";
import RecordsManager from "./records-manager";
import {isPrivateVaultUnlocked} from "@/lib/private-vault";
export const dynamic="force-dynamic";export const runtime="nodejs";
const config:any={
 orders:{title:"Fiverr Orders",desc:"Review imported orders, track delivery progress and manage order details.",fields:["order_id","client_username","project_title","category","amount","fiverr_fee","status","progress","order_url","notes"]},
 profiles:{title:"Fiverr Profiles",desc:"Manage the Fiverr usernames tracked by your workspace.",fields:["username"]},
 messages:{title:"Contact Messages",desc:"Review client enquiries, manage read status and reply to messages.",fields:[]},
 templates:{title:"Private Templates",desc:"Create and maintain reusable private response templates.",fields:["title","category","body"]}
};
export default async function ManagePage({params}:{params:Promise<{entity:string}>}){
 const session=await getAdminSession();if(!session)redirect("/admin/login");
 const {entity}=await params;const cfg=config[entity];if(!cfg)notFound();
 if(!process.env.LEGACY_DATABASE_URL)throw new Error("DATABASE_URL missing");
 const sql=neon(process.env.LEGACY_DATABASE_URL);let rows:any[]=[];
 if(entity==="orders")rows=await sql`SELECT id,order_id,client_username,project_title,category,amount,fiverr_fee,status,progress,order_url,notes,net_amount,created_at FROM cms_fiverr_orders ORDER BY created_at DESC,id DESC LIMIT 500`;
 if(entity==="profiles")rows=await sql`SELECT id,username,created_at FROM cms_fiverr_profiles ORDER BY username ASC`;
 if(entity==="messages")rows=await sql`SELECT id,name,email,service,message,is_read,created_at FROM cms_messages ORDER BY created_at DESC,id DESC LIMIT 500`;
 if(entity==="templates" && await isPrivateVaultUnlocked())rows=await sql`SELECT id,title,category,body,created_at,updated_at FROM cms_private_templates ORDER BY updated_at DESC,id DESC`;
 const count=rows.length;
 const summary=entity==="orders"?[{icon:"▤",value:count,label:"Total orders"},{icon:"◷",value:rows.filter(r=>/progress|pending/i.test(String(r.status))).length,label:"In progress / pending"},{icon:"✓",value:rows.filter(r=>/complete|deliver/i.test(String(r.status))).length,label:"Completed"}]:
 entity==="messages"?[{icon:"✉",value:count,label:"Total messages"},{icon:"●",value:rows.filter(r=>!r.is_read).length,label:"Unread messages"},{icon:"✓",value:rows.filter(r=>r.is_read).length,label:"Read messages"}]:
 [{icon:"▦",value:count,label:entity==="profiles"?"Tracked profiles":"Saved templates"},{icon:"↻",value:"Live",label:"Database connected"},{icon:"✓",value:"Safe",label:"Existing records preserved"}];
 return <main className="content-management-page">
  <header className="content-management-header"><div className="content-header-brand"><span className="content-brand-mark">S</span><div><strong>Portfolio CMS</strong><small>{cfg.title} · Signed in as {session.username}</small></div></div><Link href="/admin" className="content-back-link">← Dashboard</Link></header>
  <section className="content-management-wrap">
   <div className="content-hero"><div className="content-hero-copy"><span className="content-eyebrow">WORKSPACE MANAGEMENT</span><h1>{cfg.title}</h1><p>{cfg.desc}</p></div><div className="content-hero-badge"><span className="content-live-dot"/> Database connected</div></div>
   <div className="content-summary">{summary.map((x,i)=><div className="content-summary-item" key={i}><span className="content-summary-icon">{x.icon}</span><div><strong>{x.value}</strong><small>{x.label}</small></div></div>)}</div>
   <div className="content-editor-heading"><div><h2>{entity==="messages"?"Message inbox":entity==="orders"?"Order workspace":entity==="profiles"?"Profile manager":"Private template library"}</h2><p>Search, review and manage your existing records below.</p></div></div>
   <RecordsManager entity={entity} initialItems={rows as any[]}/>
  </section>
 </main>;
}
