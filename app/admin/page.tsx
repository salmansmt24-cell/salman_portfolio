import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Order = { id:number; order_id:string; client_username:string; project_title:string; amount:string|number; net_amount?:string|number; status:string; created_at:string };
type Message = { id:number; name:string; email:string; service:string; message:string; is_read:boolean; created_at:string };
type Month = { month:string; net:number|string; orders:number };
type Status = { status:string; total:number };
type Activity = { key:string; title:string; detail:string; when:string; kind:"order"|"message"; time:number };

const money = (v:number|string|undefined) => "$"+Number(v??0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const compactMoney = (v:number|string|undefined) => {
  const n=Number(v??0);
  return "$"+(Math.abs(n)>=1000000?(n/1000000).toFixed(1)+"m":Math.abs(n)>=1000?(n/1000).toFixed(1)+"k":n.toFixed(0));
};
const date = (v:string) => { const d=new Date(v); return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); };
const relative = (v:string) => {
  const t=new Date(v).getTime(); if(!Number.isFinite(t)) return "Recently";
  const mins=Math.max(0,Math.floor((Date.now()-t)/60000));
  if(mins<1)return "Just now"; if(mins<60)return mins+" min ago";
  const hrs=Math.floor(mins/60); if(hrs<24)return hrs+" hr ago";
  const days=Math.floor(hrs/24); return days<7?days+" days ago":date(v);
};
const clip = (s:string,n=34) => s&&s.length>n?s.slice(0,n-1)+"…":s||"—";
const palette=["#1269f5","#4bc987","#8c5cf6","#ff9d2e","#e46c9b","#39a6bd"];

export default async function AdminDashboard(){
  const session=await getAdminSession();
  if(!session) redirect("/admin/login");
  let connected=true;
  let stats={content:0,orders:0,profiles:0,messages:0,unread:0,templates:0,revenue:0,items:0};
  let orders:Order[]=[];
  let messages:Message[]=[];
  let months:Month[]=[];
  let statuses:Status[]=[];
  try{
    if(!process.env.LEGACY_DATABASE_URL) throw new Error("DATABASE_URL missing");
    const sql=neon(process.env.LEGACY_DATABASE_URL);
    const [s,o,m,monthly,statusRows]=await Promise.all([
      sql`SELECT (SELECT COUNT(*)::int FROM cms_content) content,(SELECT COUNT(*)::int FROM cms_fiverr_orders) orders,(SELECT COUNT(*)::int FROM cms_fiverr_profiles) profiles,(SELECT COUNT(*)::int FROM cms_messages) messages,(SELECT COUNT(*)::int FROM cms_messages WHERE is_read=FALSE) unread,(SELECT COUNT(*)::int FROM cms_private_templates) templates,(SELECT COUNT(*)::int FROM cms_items) items,(SELECT COALESCE(SUM(net_amount),0)::float FROM cms_fiverr_orders) revenue`,
      sql`SELECT id,order_id,client_username,project_title,amount,net_amount,status,created_at FROM cms_fiverr_orders ORDER BY created_at DESC,id DESC LIMIT 5`,
      sql`SELECT id,name,email,service,message,is_read,created_at FROM cms_messages ORDER BY created_at DESC,id DESC LIMIT 5`,
      sql`SELECT TO_CHAR(COALESCE(lead_date,created_at::date),'Mon YY') AS month,TO_CHAR(COALESCE(lead_date,created_at::date),'YYYY-MM') AS sort_month,COUNT(*)::int AS orders,COALESCE(SUM(net_amount),0)::float AS net FROM cms_fiverr_orders WHERE COALESCE(lead_date,created_at::date)>=CURRENT_DATE-INTERVAL '5 months' GROUP BY 1,2 ORDER BY 2 ASC`,
      sql`SELECT status,COUNT(*)::int AS total FROM cms_fiverr_orders GROUP BY status ORDER BY total DESC`
    ]);
    stats=s[0] as typeof stats;
    orders=o as unknown as Order[];
    messages=m as unknown as Message[];
    months=monthly as unknown as Month[];
    statuses=statusRows as unknown as Status[];
  }catch(e){connected=false;console.error("Dashboard query failed",e);}

  const totalStatus=Math.max(1,statuses.reduce((n,x)=>n+Number(x.total||0),0));
  let offset=0;
  const donut=statuses.map((x,i)=>{const pct=Number(x.total||0)/totalStatus*100;const start=offset;offset+=pct;return `${palette[i%palette.length]} ${start}% ${offset}%`;}).join(",");
  const activity:Activity[]=[
    ...orders.map(o=>({key:"o-"+o.id,title:"New order #"+(o.order_id||o.id),detail:clip(o.project_title||o.client_username||"Order received",46),when:relative(o.created_at),kind:"order" as const,time:new Date(o.created_at).getTime()||0})),
    ...messages.map(m=>({key:"m-"+m.id,title:"New message from "+(m.name||"website visitor"),detail:clip(m.message||m.service||"Contact enquiry",46),when:relative(m.created_at),kind:"message" as const,time:new Date(m.created_at).getTime()||0}))
  ].sort((a,b)=>b.time-a.time).slice(0,5);
  const cards=[
    {label:"Total Orders",value:Number(stats.orders).toLocaleString("en-US"),sub:"All recorded orders",icon:"▣",tone:"blue",href:"/admin/manage/orders"},
    {label:"Net Revenue",value:compactMoney(stats.revenue),sub:"Recorded net earnings",icon:"＄",tone:"green",href:"/admin/analytics"},
    {label:"Portfolio Content",value:Number(stats.content).toLocaleString("en-US"),sub:"Published content records",icon:"▤",tone:"purple",href:"/admin/content"},
    {label:"New Messages",value:Number(stats.unread).toLocaleString("en-US"),sub:"Unread enquiries",icon:"•••",tone:"orange",href:"/admin/manage/messages"}
  ];
  const quick=[
    {label:"Add New Content",icon:"▣",tone:"blue",href:"/admin/content"},
    {label:"Manage Orders",icon:"🛒",tone:"green",href:"/admin/manage/orders"},
    {label:"View Messages",icon:"✉",tone:"purple",href:"/admin/manage/messages"},
    {label:"Update Portfolio",icon:"▧",tone:"orange",href:"/admin/content"},
    {label:"Manage Media",icon:"▣",tone:"teal",href:"/admin/media"},
    {label:"Settings",icon:"⚙",tone:"slate",href:"/admin/account"}
  ];
  const chartValues=months.map(x=>Number(x.net)||0);
  const maxChart=Math.max(1,...chartValues);
  const linePoints=chartValues.map((v,i)=>({x:30+(months.length<=1?0:i*660/(months.length-1)),y:174-(v/maxChart)*126}));
  const linePath=linePoints.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
  const areaPath=linePoints.length?linePath+` L ${linePoints[linePoints.length-1].x} 184 L ${linePoints[0].x} 184 Z`:"";
  const chartTotal=chartValues.reduce((a,b)=>a+b,0);

  return <main className="dashv2">
    <style>{`
      .dashv2{min-height:100vh;background:#f4f7ff!important;color:#101d43!important;font-family:Inter,"DM Sans",ui-sans-serif,system-ui,sans-serif!important}
      .dashv2 *{box-sizing:border-box}
      main.dashv2>header.dash-top{position:sticky!important;top:0!important;z-index:30!important;min-height:86px!important;height:86px!important;padding:0 30px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;background:#fff!important;border:0!important;border-bottom:1px solid #e7ecf7!important;box-shadow:none!important}
      .dash-search{display:flex;align-items:center;gap:13px;width:min(590px,58%);height:48px;padding:0 20px;border:1px solid #e3e9f7;border-radius:28px;background:#f5f7ff;color:#667391}
      .dash-search-icon{font-size:22px;color:#50658f}.dash-search input{width:100%;border:0!important;outline:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;color:#53617e!important;font-size:14px!important}
      .dash-topright{display:flex;align-items:center;gap:18px}.dash-notice{position:relative;display:grid;place-items:center;width:38px;height:38px;color:#10214a;text-decoration:none;font-size:23px}
      .dash-notice em{position:absolute;right:0;top:-1px;min-width:17px;height:17px;padding:0 4px;border-radius:20px;background:#f32635;color:white;font-size:10px;font-style:normal;font-weight:800;text-align:center;line-height:17px}
      .dash-top-divider{height:34px;width:1px;background:#e3e8f2}.dash-user{display:flex;align-items:center;gap:11px;color:#14234a;font-size:13px;font-weight:800}
      .dash-avatar{width:43px;height:43px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(140deg,#a7e6c0,#5ab5a0);color:#10385b;font-size:15px;font-weight:900}
      .dash-user small{display:block;margin-top:3px;color:#8490a9;font-size:11px;font-weight:500}
      .dash-logout{border:0!important;background:transparent!important;color:#63708b!important;font-size:11px!important;font-weight:700!important;padding:8px!important}
      main.dashv2>section.dash-content{width:100%!important;max-width:none!important;margin:0!important;padding:0 30px 36px!important}
      .dash-hero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;min-height:174px;margin:0 0 18px!important;padding:28px 30px!important;border:0!important;border-radius:0 0 15px 15px!important;background:linear-gradient(105deg,#e6efff 0%,#e8edff 48%,#b8ccff 100%)!important;box-shadow:0 3px 10px rgba(51,91,164,.09)!important}
      .dash-hero:before{content:"";position:absolute;right:20%;top:-145px;width:360px;height:360px;border-radius:50%;background:rgba(255,255,255,.28)}
      .dash-hero:after{content:"";position:absolute;right:0;bottom:-110px;width:450px;height:230px;border-radius:55% 0 0 0;background:rgba(95,137,255,.2)}
      .dash-hero-copy{position:relative;z-index:2}.dash-eyebrow{display:none!important}
      .dash-hero h1{margin:0 0 8px!important;color:#102653!important;font-size:30px!important;letter-spacing:-.8px!important;font-weight:850!important}
      .dash-hero p{margin:0!important;color:#1f3765!important;font-size:15px!important}
      .dash-hero-actions{position:relative;z-index:3;display:flex;align-items:center;gap:9px;margin-top:18px}
      .dash-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 19px!important;border:0!important;border-radius:30px!important;background:#0e347e!important;color:white!important;text-decoration:none!important;font-size:13px!important;font-weight:800!important;box-shadow:0 6px 14px rgba(12,45,108,.15)!important}
      .dash-btn.secondary{display:none!important}
      .dash-hero-art{position:absolute;z-index:2;right:28px;top:3px;width:min(42%,470px);height:168px}
      .dash-sectionhead{display:flex;align-items:center;justify-content:space-between;margin:22px 0 13px!important}
      .dash-sectionhead h2{margin:0!important;color:#12234c!important;font-size:18px!important;font-weight:850!important}
      .dash-sectionhead p{margin:4px 0 0!important;color:#8794ad!important;font-size:11px!important}
      .dash-link{color:#0968f5!important;text-decoration:none!important;font-size:12px!important;font-weight:800!important}
      .dash-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px!important}
      .dash-stat{position:relative;overflow:hidden;display:block;min-width:0;min-height:135px;padding:19px 20px!important;border:1px solid #e1e9fb!important;border-radius:14px!important;background:linear-gradient(145deg,#fff,#f7faff)!important;text-decoration:none!important;color:inherit!important;box-shadow:0 4px 13px rgba(28,55,110,.045)!important}
      .dash-stat:after{content:"";position:absolute;right:-28px;bottom:-56px;width:170px;height:100px;border-radius:50%;background:var(--stat-pale);opacity:.65}
      .dash-stat.blue{--stat:#348cff;--stat-pale:#dceaff}.dash-stat.green{--stat:#4ac68b;--stat-pale:#d9f7e9}.dash-stat.purple{--stat:#8959f6;--stat-pale:#eee3ff}.dash-stat.orange{--stat:#ff982e;--stat-pale:#ffead3}
      .dash-stathead{position:relative;z-index:1;display:flex;align-items:center;justify-content:flex-start;gap:13px;color:#112149;font-size:12px;font-weight:650}
      .dash-staticon{width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:var(--stat)!important;color:#fff!important;font-size:21px!important;font-weight:900}
      .dash-statvalue{position:absolute;z-index:2;left:86px;top:26px;margin:0!important;color:#101d43!important;font-size:26px!important;font-weight:850!important;letter-spacing:-.5px!important}
      .dash-statsub{position:absolute;z-index:2;left:86px;top:61px;color:#31456f!important;font-size:12px!important}
      .dash-stat:hover{transform:translateY(-3px);box-shadow:0 10px 20px rgba(28,55,110,.10)!important}
      .dash-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(350px,.85fr);gap:16px!important;margin-top:17px!important}
      .dash-panel{min-width:0;overflow:hidden;border:1px solid #e1e8f7!important;border-radius:14px!important;background:#fff!important;box-shadow:0 4px 12px rgba(26,50,100,.04)!important}
      .dash-panelhead{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:61px;padding:15px 20px!important;border-bottom:1px solid #edf1f8!important}
      .dash-paneltitle{display:flex;align-items:center;gap:13px}.dash-panelicon{color:#0968f5;font-size:21px;font-weight:900}
      .dash-panelhead h3{margin:0!important;color:#111d43!important;font-size:15px!important;font-weight:850!important}
      .dash-panelhead small{color:#8a97b0!important;font-size:10px!important}
      .dash-chart{position:relative;padding:12px 19px 10px!important}
      .dash-charttools{display:flex;gap:5px}.dash-charttools span{padding:6px 11px;border:1px solid #e3eaf7;border-radius:7px;color:#263a65;font-size:10px;font-weight:750}.dash-charttools span.active{background:#096bf7;color:#fff;border-color:#096bf7}
      .dash-linechart{display:block;width:100%;height:190px;overflow:visible}
      .dash-chartlabels{display:flex;justify-content:space-between;padding:0 6px 0 34px;color:#152650;font-size:10px}
      .dash-chartmeta{display:flex;justify-content:space-between;gap:10px;margin:12px 0 0;padding-top:10px;border-top:1px solid #eff2f8;color:#8793aa;font-size:10px}
      .dash-sales{display:flex;align-items:center;justify-content:center;gap:22px;min-height:239px;padding:19px!important}
      .dash-donut{width:174px;height:174px;flex:0 0 174px;display:grid;place-items:center;border-radius:50%;background:conic-gradient(${donut||"#e9edf4 0% 100%"})}
      .dash-donutinner{width:106px;height:106px;display:grid;place-items:center;align-content:center;border-radius:50%;background:#fff;text-align:center}
      .dash-donutinner b{color:#111e44;font-size:22px;font-weight:850}.dash-donutinner small{margin-top:4px;color:#697b9e;font-size:11px}
      .dash-legend{display:grid;gap:14px;min-width:0}.dash-legendrow{display:flex;align-items:center;gap:8px;color:#14234a;font-size:11px}.dash-legendrow b{margin-left:3px;color:#64749a;font-weight:500}
      .dash-legenddot{width:10px;height:10px;flex:0 0 10px;border-radius:50%}
      .dash-bottom{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,1.05fr) minmax(270px,1fr);gap:15px!important;margin-top:17px!important;align-items:stretch}
      .dash-bottom>.dash-panel{min-height:246px}
      .dash-tablewrap{overflow:auto}.dash-table{width:100%;border-collapse:collapse;white-space:nowrap;text-align:left}
      .dash-table th{padding:12px 13px!important;background:#fff!important;color:#15244a!important;font-size:10px!important;text-transform:none!important;letter-spacing:0!important}
      .dash-table td{padding:13px!important;border-top:1px solid #eef1f7!important;color:#263a62!important;font-size:10px!important}
      .dash-table td strong{color:#13234b!important}.dash-table tbody tr:hover{background:#f8faff!important}
      .dash-customer{display:flex;align-items:center;gap:8px}.dash-customer-avatar{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:#dce9ff;color:#1455bb;font-size:9px;font-weight:850}
      .dash-pill{display:inline-block;padding:5px 9px;border-radius:30px;background:#edf1f8;color:#60718f;font-size:9px;font-weight:800}
      .dash-pill.good{background:#d9f8e7;color:#16854f}.dash-pill.wait{background:#dfeeff;color:#1764d3}.dash-pill.bad{background:#ffe1ec;color:#c62b68}
      .dash-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:11px!important}
      .dash-quick a{display:flex;min-width:0;min-height:85px;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px 5px!important;border:0!important;border-radius:12px!important;text-align:center;text-decoration:none!important;color:#15244b!important}
      .dash-quick a:hover{transform:translateY(-2px);filter:brightness(.985)}
      .dash-quickicon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#eaf2ff;color:#0968f5;font-size:18px}
      .dash-quick a.green .dash-quickicon{background:#e2f9ed;color:#13a45c}.dash-quick a.purple .dash-quickicon{background:#f0e9ff;color:#8754f2}.dash-quick a.orange .dash-quickicon{background:#fff0e0;color:#ff941d}.dash-quick a.teal .dash-quickicon{background:#e1f8f7;color:#12a3a5}.dash-quick a.slate .dash-quickicon{background:#eef0f8;color:#59658c}
      .dash-quick b{display:block;max-width:100%;font-size:10px!important;line-height:1.25;color:#18284f!important;font-weight:700!important}
      .dash-quick small{display:none!important}
      .dash-activity{position:relative;padding:8px 17px 10px 21px!important}
      .dash-event{position:relative;display:flex;gap:11px;padding:11px 0!important;border-bottom:0!important}
      .dash-event:before{content:"";position:absolute;left:13px;top:38px;bottom:-8px;width:2px;background:#e4eafa}.dash-event:last-child:before{display:none}
      .dash-eventicon{position:relative;z-index:1;width:31px;height:31px;flex:0 0 31px;display:grid;place-items:center;border-radius:50%;background:#ddf8e9;color:#18a963;font-size:14px}
      .dash-eventicon.message{background:#e2efff;color:#126df2}
      .dash-eventbody{min-width:0;padding-top:2px}.dash-eventbody b{display:block;color:#15244a!important;font-size:10px!important;font-weight:800!important}
      .dash-eventbody small{display:block;margin-top:3px;color:#7c8bad!important;font-size:10px!important}
      .dash-eventbody p{display:none!important}
      .dash-empty{padding:26px 14px;text-align:center;color:#8c99b1;font-size:11px}
      .dash-foot{margin-top:14px;text-align:right;color:#94a0b5;font-size:9px}
      @media(max-width:1250px){.dash-grid{grid-template-columns:minmax(0,1.3fr) minmax(310px,.9fr)}.dash-bottom{grid-template-columns:1fr 1fr}.dash-bottom>.dash-panel:first-child{grid-column:1/-1}}
      @media(max-width:900px){main.dashv2>section.dash-content{padding:0 18px 28px!important}.dash-grid{grid-template-columns:1fr}.dash-bottom{grid-template-columns:1fr 1fr}.dash-bottom>.dash-panel:first-child{grid-column:1/-1}.dash-hero-art{width:38%;right:5px}}
      @media(max-width:760px){
        main.dashv2>header.dash-top{height:64px!important;min-height:64px!important;padding:0 14px!important}
        .dash-search{width:55%;height:38px;padding:0 12px}.dash-search input{font-size:11px!important}.dash-search-icon{font-size:17px}
        .dash-topright{gap:8px}.dash-user{gap:6px;font-size:11px}.dash-user small,.dash-logout,.dash-top-divider{display:none}.dash-avatar{width:34px;height:34px}
        main.dashv2>section.dash-content{padding:0 13px 25px!important}
        .dash-hero{min-height:155px!important;padding:22px 18px!important;margin-bottom:13px!important}.dash-hero h1{max-width:65%;font-size:21px!important}.dash-hero p{max-width:58%;font-size:11px!important}.dash-hero-art{width:43%;height:130px;right:-7px;top:17px}.dash-hero-actions{margin-top:13px}.dash-btn{padding:9px 13px!important;font-size:10px!important}
        .dash-sectionhead{margin:18px 0 10px!important}.dash-sectionhead h2{font-size:15px!important}
        .dash-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px!important}.dash-stat{min-height:112px;padding:12px!important}.dash-staticon{width:38px;height:38px;font-size:16px}.dash-statvalue{left:60px;top:20px;font-size:21px!important}.dash-statsub{left:60px;top:49px;font-size:9px!important}.dash-stathead{font-size:10px}
        .dash-grid{grid-template-columns:1fr;gap:11px!important;margin-top:12px!important}.dash-panelhead{min-height:53px;padding:12px 14px!important}.dash-panelhead h3{font-size:13px!important}.dash-chart{padding:9px 11px}.dash-linechart{height:155px}.dash-charttools span{padding:5px 7px;font-size:8px}.dash-sales{min-height:0;gap:16px;padding:16px!important}.dash-donut{width:130px;height:130px;flex-basis:130px}.dash-donutinner{width:80px;height:80px}.dash-donutinner b{font-size:17px}.dash-legend{gap:10px}.dash-legendrow{font-size:10px}
        .dash-bottom{grid-template-columns:1fr!important;gap:11px!important;margin-top:12px!important}.dash-bottom>.dash-panel:first-child{grid-column:auto}.dash-bottom>.dash-panel{min-height:0}
        .dash-table{min-width:600px}.dash-quick{grid-template-columns:repeat(3,minmax(0,1fr));padding:9px!important}.dash-quick a{min-height:77px}.dash-quickicon{width:33px;height:33px}.dash-quick b{font-size:9px!important}.dash-activity{padding:6px 14px 10px!important}
      }
      @media(max-width:390px){.dash-hero-art{opacity:.75}.dash-hero h1{font-size:18px!important}.dash-quick{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(prefers-reduced-motion:reduce){.dashv2 *{transition:none!important}}
    `}</style>
    <header className="dash-top">
      <div className="dash-search"><span className="dash-search-icon">⌕</span><input aria-label="Search" placeholder="Search anything... (Ctrl + K)" disabled/></div>
      <div className="dash-topright">
        <Link className="dash-notice" href="/admin/manage/messages" aria-label="Notifications">♧{Number(stats.unread)>0&&<em>{stats.unread>9?"9+":stats.unread}</em>}</Link>
        <span className="dash-top-divider"/>
        <div className="dash-user"><div className="dash-avatar">{session.username.slice(0,1).toUpperCase()}</div><span>{session.username}<small>Administrator</small></span></div>
        <form action="/api/admin/logout" method="post"><button className="dash-logout">Logout</button></form>
      </div>
    </header>
    <section className="dash-content">
      <div className="dash-hero">
        <div className="dash-hero-copy"><h1>Welcome back, {session.username}! 👋</h1><p>Here’s what’s happening with your website today.</p>
          <div className="dash-hero-actions"><Link className="dash-btn" href="/admin/analytics">View Analytics <span>→</span></Link></div>
        </div>
        <svg className="dash-hero-art" viewBox="0 0 480 190" fill="none" aria-hidden="true">
          <ellipse cx="245" cy="177" rx="215" ry="13" fill="#779BFA" opacity=".24"/>
          <path d="M80 166h260l-22 9H103z" fill="#345FCE"/>
          <path d="M150 20h180a9 9 0 0 1 9 9v119H141V29a9 9 0 0 1 9-9Z" fill="#263A73"/>
          <rect x="150" y="29" width="180" height="108" rx="4" fill="#F9FBFF"/>
          <path d="m168 111 31-26 27 13 34-46 24 14 24-30" stroke="#C8D7FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M176 112v-22h18v22zm35 0V75h18v37zm35 0V59h18v53zm35 0V44h18v68z" fill="#755AF0"/>
          <path d="M175 118h110" stroke="#D8E3FF" strokeWidth="2"/>
          <path d="M135 151h210l-17 14H119z" fill="#4D70C8"/>
          <path d="M379 61c-7-27 4-44 22-51 10 18 7 38-22 51Z" fill="#399D72"/>
          <path d="M388 71c5-29 24-42 43-38-1 21-16 37-43 38Z" fill="#55B98B"/>
          <path d="M379 83c-19-23-39-23-51-11 12 18 30 23 51 11Z" fill="#48AA7E"/>
          <path d="M381 91v51" stroke="#397B67" strokeWidth="4" strokeLinecap="round"/>
          <path d="M362 141h39l-5 25h-29z" fill="#F8FAFF"/><path d="M362 141h39" stroke="#D7E2F6" strokeWidth="2"/>
          <circle cx="85" cy="43" r="4" fill="#fff"/><circle cx="105" cy="62" r="3" fill="#fff"/><circle cx="353" cy="26" r="5" fill="#fff"/>
        </svg>
      </div>
      <div className="dash-stats">{cards.map(c=><Link className={"dash-stat "+c.tone} href={c.href} key={c.label}>
        <div className="dash-stathead"><span className="dash-staticon">{c.icon}</span></div><div className="dash-statvalue">{c.value}</div><div className="dash-statsub">{c.label}</div>
        <svg className="dash-spark" viewBox="0 0 130 42" aria-hidden="true"><path d="M2 35 C18 34 18 25 31 28 S49 13 63 19 S80 6 93 13 S112 4 128 8" fill="none" stroke="var(--stat)" strokeWidth="2.5" strokeLinecap="round"/></svg>
      </Link>)}</div>
      <div className="dash-grid">
        <section className="dash-panel">
          <div className="dash-panelhead"><div className="dash-paneltitle"><span className="dash-panelicon">▥</span><h3>Analytics Overview</h3></div><div className="dash-charttools"><span>7D</span><span className="active">30D</span><span>90D</span><span>1Y</span></div></div>
          <div className="dash-chart">
            {months.length?<><svg className="dash-linechart" viewBox="0 0 720 205" preserveAspectRatio="none" role="img" aria-label="Monthly net revenue line chart">
              {[48,91,134,177].map(y=><g key={y}><path d={`M30 ${y}H700`} stroke="#e9eef8" strokeWidth="1"/><text x="3" y={y+4} fill="#72809d" fontSize="10">{Math.round(maxChart*(177-y)/129).toLocaleString("en-US")}</text></g>)}
              {months.map((m,i)=>{const x=30+(months.length<=1?0:i*660/(months.length-1));return <path key={m.month} d={`M${x} 20V184`} stroke="#edf1fa" strokeWidth="1"/>;})}
              <path d={areaPath} fill="#1675ff" opacity=".12"/><path d={linePath} stroke="#096cf7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              {linePoints.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#096cf7" stroke="#fff" strokeWidth="2"/> )}
            </svg><div className="dash-chartlabels">{months.map(m=><span key={m.month}>{m.month}</span>)}</div></>:<div className="dash-empty">Monthly earnings will appear here when order records are available.</div>}
            <div className="dash-chartmeta"><span>{months.reduce((n,m)=>n+Number(m.orders||0),0)} orders · last 6 months</span><strong>{money(chartTotal)}</strong></div>
          </div>
        </section>
        <section className="dash-panel">
          <div className="dash-panelhead"><div className="dash-paneltitle"><span className="dash-panelicon">⌁</span><h3>Sales Performance</h3></div><small>{stats.orders} total orders</small></div>
          {statuses.length?<div className="dash-sales"><div className="dash-donut"><div className="dash-donutinner"><b>{compactMoney(stats.revenue)}</b><small>Total Sales</small></div></div><div className="dash-legend">{statuses.slice(0,5).map((x,i)=><div className="dash-legendrow" key={x.status}><span className="dash-legenddot" style={{background:palette[i%palette.length]}}/><span>{clip(x.status||"Unknown",17)}</span><b>{Math.round(Number(x.total||0)/totalStatus*100)}%</b></div>)}</div></div>:<div className="dash-empty">No sales performance data available yet.</div>}
        </section>
      </div>
      <div className="dash-bottom">
        <section className="dash-panel">
          <div className="dash-panelhead"><div className="dash-paneltitle"><span className="dash-panelicon">🛒</span><h3>Recent Orders</h3></div><Link className="dash-link" href="/admin/manage/orders">View All →</Link></div>
          <div className="dash-tablewrap"><table className="dash-table"><thead><tr><th>#</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><strong>#{clip(o.order_id,13)}</strong></td><td><span className="dash-customer"><span className="dash-customer-avatar">{(o.client_username||"C").slice(0,1).toUpperCase()}</span>{clip(o.client_username,16)}</span></td><td><strong>{money(o.net_amount??o.amount)}</strong></td><td><span className={"dash-pill "+(/complete|delivered|done/i.test(o.status)?"good":/cancel|reject/i.test(o.status)?"bad":/progress|process/i.test(o.status)?"wait":"")}>{clip(o.status||"Pending",13)}</span></td><td>{date(o.created_at)}</td></tr>)}</tbody></table>{!orders.length&&<div className="dash-empty">No recent orders.</div>}</div>
        </section>
        <section className="dash-panel">
          <div className="dash-panelhead"><div className="dash-paneltitle"><span className="dash-panelicon">ϟ</span><h3>Quick Actions</h3></div></div>
          <div className="dash-quick">{quick.map(q=><Link className={q.tone} href={q.href} key={q.label}><span className="dash-quickicon">{q.icon}</span><b>{q.label}</b></Link>)}</div>
        </section>
        <section className="dash-panel">
          <div className="dash-panelhead"><div className="dash-paneltitle"><span className="dash-panelicon">◷</span><h3>Recent Activity</h3></div><Link className="dash-link" href="/admin/manage/messages">View All →</Link></div>
          <div className="dash-activity">{activity.map((a,i)=><article className="dash-event" key={a.key}><span className={"dash-eventicon "+(a.kind==="message"?"message":"")}>{a.kind==="message"?"✉":"🛒"}</span><div className="dash-eventbody"><b>{a.title}</b><small>{a.when}</small></div></article>)}{!activity.length&&<div className="dash-empty">Your latest orders and messages will appear here.</div>}</div>
        </section>
      </div>
      <div className="dash-foot">{connected?"Database connected":"Database unavailable"} · Secure admin workspace</div>
    </section>
  </main>;
}
