import {notFound,redirect} from "next/navigation";
import Link from "next/link";
import {neon} from "@neondatabase/serverless";
import {getAdminSession} from "@/lib/admin-auth";
import RecordsManager from "./records-manager";import {isPrivateVaultUnlocked} from "@/lib/private-vault";
export const dynamic="force-dynamic";export const runtime="nodejs";
const config:any={
 orders:{title:"Fiverr Orders",desc:"Review imported orders and manage order details.",cols:["Order ID","Client","Project","Amount","Status","Progress"],fields:["order_id","client_username","project_title","category","amount","fiverr_fee","status","progress","order_url","notes"]},
 profiles:{title:"Fiverr Profiles",desc:"Manage the Fiverr usernames tracked by your workspace.",cols:["Username","Created"],fields:["username"]},
 messages:{title:"Contact Messages",desc:"Read, mark as unread or remove contact form submissions.",cols:["Name","Email","Service","Message","Status"],fields:[]},
 templates:{title:"Private Templates",desc:"Create and maintain reusable private response templates.",cols:["Title","Category","Updated"],fields:["title","category","body"]}
};
export default async function ManagePage({params}:{params:Promise<{entity:string}>}){const session=await getAdminSession();if(!session)redirect("/admin/login");const {entity}=await params;const cfg=config[entity];if(!cfg)notFound();if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL missing");const sql=neon(process.env.DATABASE_URL);let rows:any[]=[];
if(entity==="orders")rows=await sql`SELECT id,order_id,client_username,project_title,category,amount,fiverr_fee,status,progress,order_url,notes,net_amount,created_at FROM cms_fiverr_orders ORDER BY created_at DESC,id DESC LIMIT 500`;
if(entity==="profiles")rows=await sql`SELECT id,username,created_at FROM cms_fiverr_profiles ORDER BY username ASC`;
if(entity==="messages")rows=await sql`SELECT id,name,email,service,message,is_read,created_at FROM cms_messages ORDER BY created_at DESC,id DESC LIMIT 500`;
if(entity==="templates" && await isPrivateVaultUnlocked())rows=await sql`SELECT id,title,category,body,created_at,updated_at FROM cms_private_templates ORDER BY updated_at DESC,id DESC`;
return <main style={{minHeight:"100vh",background:"#f5f7fb",color:"#1b2940",fontFamily:"Arial,sans-serif"}}><header style={{background:"#fff",borderBottom:"1px solid #e5ebf3",padding:"17px 4%",display:"flex",justifyContent:"space-between"}}><div><strong>JS Salman CMS</strong><div style={{fontSize:12,color:"#8794a8",marginTop:4}}>{cfg.title} · {session.username}</div></div><Link href="/admin" style={{color:"#285db4",fontSize:13,textDecoration:"none"}}>← Dashboard</Link></header><section style={{maxWidth:1250,margin:"auto",padding:"32px 22px"}}><div style={{fontSize:11,color:"#6884b3",fontWeight:800,letterSpacing:1.3}}>WORKSPACE MANAGEMENT</div><h1 style={{fontSize:28,margin:"8px 0"}}>{cfg.title}</h1><p style={{color:"#8190a5",fontSize:13}}>{cfg.desc}</p><RecordsManager entity={entity} initialItems={rows as any[]}/></section></main>}
