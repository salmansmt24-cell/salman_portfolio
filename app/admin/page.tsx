import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Order = { id:number; order_id:string; client_username:string; project_title:string; amount:string|number; status:string; created_at:string };
type Message = { id:number; name:string; email:string; service:string; message:string; is_read:boolean; created_at:string };

const nav = [
  { label:"Overview", href:"/admin", icon:"◫", active:true },
  { label:"Content editor", href:"/admin/content", icon:"✎" },
  { label:"Collections", href:"/admin/collections", icon:"▦" },
  { label:"Fiverr orders", href:"#orders", icon:"↗", soon:true },
  { label:"Fiverr profiles", href:"#profiles", icon:"◎", soon:true },
  { label:"Messages", href:"#messages", icon:"✉", soon:true },
  { label:"Media library", href:"#media", icon:"▧", soon:true },
  { label:"Private templates", href:"#templates", icon:"▤", soon:true },
  { label:"Analytics & insights", href:"#analytics", icon:"▥", soon:true },
];

function money(value:number|string|undefined) {
  return "$" + Number(value ?? 0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function dateLabel(value:string|undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
}
function short(value:string,max=54) { return value.length>max ? value.slice(0,max-1)+"…" : value; }

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  let dbStatus = "Connected";
  let stats = { content:0, orders:0, profiles:0, messages:0, unread:0, templates:0, revenue:0, items:0 };
  let orders:Order[] = [];
  let messages:Message[] = [];
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
    const sql = neon(process.env.DATABASE_URL);
    const [summary, recentOrders, recentMessages] = await Promise.all([
      sql`SELECT
        (SELECT COUNT(*)::int FROM cms_content) AS content,
        (SELECT COUNT(*)::int FROM cms_fiverr_orders) AS orders,
        (SELECT COUNT(*)::int FROM cms_fiverr_profiles) AS profiles,
        (SELECT COUNT(*)::int FROM cms_messages) AS messages,
        (SELECT COUNT(*)::int FROM cms_messages WHERE is_read = FALSE) AS unread,
        (SELECT COUNT(*)::int FROM cms_private_templates) AS templates,
        (SELECT COUNT(*)::int FROM cms_items) AS items,
        (SELECT COALESCE(SUM(net_amount),0)::float FROM cms_fiverr_orders) AS revenue`,
      sql`SELECT id,order_id,client_username,project_title,amount,status,created_at
          FROM cms_fiverr_orders ORDER BY created_at DESC,id DESC LIMIT 6`,
      sql`SELECT id,name,email,service,message,is_read,created_at
          FROM cms_messages ORDER BY created_at DESC,id DESC LIMIT 5`
    ]);
    stats = summary[0] as typeof stats;
    orders = recentOrders as unknown as Order[];
    messages = recentMessages as unknown as Message[];
  } catch (error) {
    dbStatus = "Unavailable";
    console.error("Admin dashboard database read failed:",error);
  }

  const statCards = [
    {label:"Portfolio fields",value:stats.content,sub:"Editable content records",icon:"✎",tone:"blue"},
    {label:"Fiverr orders",value:stats.orders,sub:"Orders in your database",icon:"↗",tone:"violet"},
    {label:"Net earnings",value:money(stats.revenue),sub:"Imported order net amount",icon:"$",tone:"green"},
    {label:"Contact messages",value:stats.messages,sub:stats.unread+" unread messages",icon:"✉",tone:"orange"},
    {label:"Fiverr profiles",value:stats.profiles,sub:"Tracked profiles",icon:"◎",tone:"cyan"},
    {label:"Portfolio items",value:stats.items,sub:"Across all collections",icon:"▦",tone:"pink"},
  ];

  return <main className="admin-shell">
    <style>{`
      *{box-sizing:border-box}.admin-shell{min-height:100vh;background:#f5f7fb;color:#18243a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex}
      .sidebar{width:252px;flex:0 0 252px;background:#101b31;color:#c4cee0;padding:25px 16px;display:flex;flex-direction:column;min-height:100vh}
      .brand{display:flex;align-items:center;gap:11px;padding:0 10px 28px;border-bottom:1px solid #29364d}.brand-mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#4f8cff,#7c5cff);display:grid;place-items:center;color:white;font-weight:800;font-size:18px}.brand strong{display:block;color:#fff;font-size:14px;letter-spacing:.2px}.brand small{color:#8998b2;font-size:11px}
      .nav-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#71819d;padding:25px 12px 10px;font-weight:800}.nav-list{display:grid;gap:5px}.nav-link{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;color:#aebbd0;text-decoration:none;font-size:13px;font-weight:600}.nav-link .nav-icon{width:20px;text-align:center;font-size:16px}.nav-link.active{background:#263958;color:#fff;box-shadow:inset 3px 0 #6b9cff}.nav-link.disabled{opacity:.55;cursor:default}.soon{margin-left:auto;font-size:9px;color:#8595b0;background:#24324a;padding:3px 6px;border-radius:5px}
      .sidebar-bottom{margin-top:auto;padding:15px 10px 0;border-top:1px solid #29364d;font-size:11px;color:#8291aa;line-height:1.7}.sidebar-bottom strong{color:#dce5f3}
      .main-area{min-width:0;flex:1}.topbar{height:72px;background:#fff;border-bottom:1px solid #e8edf4;display:flex;align-items:center;justify-content:space-between;padding:0 34px}.crumb{font-size:12px;color:#8a97aa}.crumb strong{color:#35445d}.user-chip{display:flex;align-items:center;gap:10px;font-size:12px;color:#5c6a80}.avatar{width:34px;height:34px;border-radius:50%;background:#e7efff;color:#2858a6;display:grid;place-items:center;font-weight:800}.logout{border:1px solid #e1e7ef;background:#fff;border-radius:8px;padding:8px 12px;color:#56647a;font-weight:650;font-size:12px;cursor:pointer}
      .content{max-width:1440px;margin:auto;padding:32px 34px 50px}.page-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#6683b5}.page-heading h1{font-size:27px;letter-spacing:-.8px;margin:7px 0 5px;color:#18243a}.page-heading p{margin:0;color:#8190a5;font-size:13px}.status{display:flex;align-items:center;gap:7px;font-size:11px;color:#66758b;background:#fff;border:1px solid #e6ebf2;padding:8px 11px;border-radius:8px}.dot{width:7px;height:7px;border-radius:50%;background:#16a36a}.dot.off{background:#d04444}
      .stats-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.stat-card{background:#fff;border:1px solid #e8edf4;border-radius:13px;padding:19px 20px;min-width:0;box-shadow:0 3px 12px #1c345008}.stat-top{display:flex;justify-content:space-between;align-items:center}.stat-label{font-size:12px;color:#748198;font-weight:650}.stat-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:16px}.stat-value{font-size:26px;letter-spacing:-.7px;font-weight:800;margin:13px 0 4px;color:#1b2940}.stat-sub{font-size:11px;color:#9aa5b5}.blue{background:#eaf1ff;color:#3970d2}.violet{background:#f0edff;color:#7154c8}.green{background:#e6f7ef;color:#16875a}.orange{background:#fff2e7;color:#d47a32}.cyan{background:#e5f7fa;color:#16869a}.pink{background:#ffedf4;color:#c65b88}
      .section-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:16px;margin-top:20px}.panel{background:#fff;border:1px solid #e8edf4;border-radius:13px;overflow:hidden;min-width:0;box-shadow:0 3px 12px #1c345008}.panel-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #edf0f5}.panel-head h2{font-size:14px;margin:0;color:#26354c}.panel-head span{font-size:11px;color:#97a2b2}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}th{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:#99a4b4;font-weight:750;padding:12px 18px;background:#fbfcfe}td{padding:13px 18px;border-top:1px solid #f0f2f6;font-size:11px;color:#65738a}td strong{color:#2d3b52;font-weight:700}.pill{display:inline-flex;border-radius:20px;padding:4px 8px;font-size:10px;font-weight:700;background:#eef2f8;color:#64748b}.pill.done{background:#e7f7ef;color:#178452}.pill.pending{background:#fff4e5;color:#b87522}.empty{padding:30px;text-align:center;color:#9aa5b5;font-size:12px}
      .message-list{padding:4px 18px}.message-row{padding:14px 2px;border-bottom:1px solid #f0f2f6;display:flex;gap:11px}.message-row:last-child{border-bottom:0}.message-avatar{width:32px;height:32px;border-radius:10px;background:#eef3ff;color:#5375b3;display:grid;place-items:center;font-size:12px;font-weight:800;flex:0 0 32px}.message-info{min-width:0;flex:1}.message-info strong{display:block;font-size:11px;color:#34435a}.message-info small{display:block;font-size:10px;color:#98a3b3;margin-top:3px}.message-info p{font-size:11px;color:#758197;margin:6px 0 0;line-height:1.5}.unread{width:6px;height:6px;border-radius:50%;background:#4384ec;margin-top:6px;flex:0 0 6px}
      .lower-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-top:16px}.module-list{padding:7px 18px 13px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.module-item{border:1px solid #edf0f5;border-radius:9px;padding:11px 12px;display:flex;align-items:center;gap:9px}.module-item span:first-child{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:#f0f4fb;color:#5876ad}.module-item strong{font-size:11px;color:#46556b;display:block}.module-item small{font-size:9px;color:#a0aaba}.module-item .state{margin-left:auto;font-size:9px;color:#b07c38;background:#fff5e7;border-radius:5px;padding:3px 5px}
      .notice{padding:17px 19px;background:#f8faff;border:1px solid #e6edfa;border-radius:11px;margin-top:16px;color:#718099;font-size:11px;line-height:1.7}.notice strong{color:#445c80}
      @media(max-width:1050px){.sidebar{width:215px;flex-basis:215px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-grid{grid-template-columns:1fr}.lower-grid{grid-template-columns:1fr}}
      @media(max-width:700px){.admin-shell{display:block}.sidebar{width:100%;min-height:0;padding:15px}.brand{padding-bottom:13px}.nav-label{padding:14px 10px 8px}.nav-list{display:flex;overflow:auto}.nav-link{white-space:nowrap;padding:9px}.sidebar-bottom{display:none}.topbar{height:58px;padding:0 16px}.content{padding:24px 15px}.page-heading{align-items:flex-start;flex-direction:column}.stats-grid{gap:9px}.stat-card{padding:14px}.stat-value{font-size:21px}.stat-sub{font-size:10px}.module-list{grid-template-columns:1fr}.user-chip{font-size:10px}}
    `}</style>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><strong>JS SALMAN CMS</strong><small>Portfolio control panel</small></div></div>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list">{nav.map(item=><Link key={item.label} href={item.href} className={"nav-link "+(item.active?"active":"")+(item.soon?" disabled":"")} aria-disabled={item.soon}><span className="nav-icon">{item.icon}</span>{item.label}{item.soon&&<span className="soon">NEXT</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><strong>Migration preview</strong><br/>Your existing portfolio database is connected here. Production remains unchanged.</div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="crumb">Workspace&nbsp; / &nbsp;<strong>Overview</strong></div><div className="user-chip"><div className="avatar">{session.username.slice(0,1).toUpperCase()}</div><span>{session.username}</span><form action="/api/admin/logout" method="post"><button className="logout">Sign out</button></form></div></header>
      <section className="content">
        <div className="page-heading"><div><div className="eyebrow">Control center</div><h1>Good to see you, {session.username}</h1><p>Here’s what’s happening across your portfolio and business workspace.</p></div><div className="status"><span className={"dot "+(dbStatus==="Connected"?"":"off")}/>{dbStatus==="Connected"?"Neon database connected":"Database unavailable"}</div></div>
        <div className="stats-grid">{statCards.map(card=><article className="stat-card" key={card.label}><div className="stat-top"><span className="stat-label">{card.label}</span><span className={"stat-icon "+card.tone}>{card.icon}</span></div><div className="stat-value">{card.value}</div><div className="stat-sub">{card.sub}</div></article>)}</div>
        <div className="section-grid">
          <section className="panel" id="orders"><div className="panel-head"><h2>Recent Fiverr orders</h2><span>Latest 6 records</span></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Client</th><th>Project</th><th>Amount</th><th>Status</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><strong>#{short(order.order_id,18)}</strong></td><td>{short(order.client_username||"—",18)}</td><td>{short(order.project_title||"—",30)}</td><td><strong>{money(order.amount)}</strong></td><td><span className={"pill "+(/complete|delivered|done/i.test(order.status)?"done":/pending|progress/i.test(order.status)?"pending":"")}>{order.status||"Unknown"}</span></td></tr>)}</tbody></table>{orders.length===0&&<div className="empty">No order records found.</div>}</div></section>
          <section className="panel" id="messages"><div className="panel-head"><h2>Latest contact messages</h2><span>{stats.unread} unread</span></div><div className="message-list">{messages.map(message=><article className="message-row" key={message.id}><div className="message-avatar">{message.name.slice(0,1).toUpperCase()}</div><div className="message-info"><strong>{short(message.name,28)}</strong><small>{message.email} · {message.service} · {dateLabel(message.created_at)}</small><p>{short(message.message,92)}</p></div>{!message.is_read&&<span className="unread"/>}</article>)}{messages.length===0&&<div className="empty">No contact messages found.</div>}</div></section>
        </div>
        <div className="lower-grid">
          <section className="panel"><div className="panel-head"><h2>Management workspace</h2><span>{stats.templates} saved templates</span></div><div className="module-list">{nav.slice(1).map(item=><div className="module-item" key={item.label}><span>{item.icon}</span><div><strong>{item.label}</strong><small>Module migration in progress</small></div><span className="state">Planned</span></div>)}</div></section>
          <section className="panel"><div className="panel-head"><h2>Database snapshot</h2><span>Live counts</span></div><div className="message-list">{[["Content fields",stats.content],["Collection items",stats.items],["Fiverr profiles",stats.profiles],["Private templates",stats.templates],["Contact messages",stats.messages],["Fiverr orders",stats.orders]].map(([label,value])=><div className="message-row" key={label}><div className="message-info"><strong>{label}</strong></div><strong style={{fontSize:13,color:"#34435a"}}>{value}</strong></div>)}</div></section>
        </div>
        <div className="notice"><strong>Migration status:</strong> This is the upgraded live-data overview. Content editing, collection management, order management and the remaining legacy PHP modules are being migrated in separate tested steps. No sample records are shown, and the production site has not been changed.</div>
      </section>
    </div>
  </main>;
}
