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
const date = (v:string) => { const d=new Date(v); return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const clip = (s:string,n=34) => s&&s.length>n?s.slice(0,n-1)+"…":s||"—";
const nav = [
  {label:"Add content",href:"/admin/content",icon:"＋",hint:"Create a portfolio update"},
  {label:"Manage orders",href:"/admin/manage/orders",icon:"↗",hint:"Review Fiverr projects"},
  {label:"View messages",href:"/admin/manage/messages",icon:"✉",hint:"Read client enquiries"},
  {label:"Update portfolio",href:"/admin/content",icon:"✎",hint:"Edit website sections"}
];

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

  const maxMonthly=Math.max(1,...months.map(x=>Number(x.net)||0));
  const totalStatus=Math.max(1,statuses.reduce((n,x)=>n+Number(x.total||0),0));
  const palette=["#635bdb","#4f83db","#22a77b","#e2a04c","#d86f94","#48a4b6"];
  let offset=0;
  const donut=statuses.map((x,i)=>{const pct=Number(x.total||0)/totalStatus*100;const start=offset;offset+=pct;return `${palette[i%palette.length]} ${start}% ${offset}%`;}).join(",");
  const activity:Activity[]=[
    ...orders.map(o=>({key:"o-"+o.id,title:"New Fiverr order "+(o.order_id?"#"+o.order_id:""),detail:clip(o.project_title||o.client_username||"Order received",42),when:date(o.created_at),kind:"order" as const,time:new Date(o.created_at).getTime()||0})),
    ...messages.map(m=>({key:"m-"+m.id,title:"New message from "+(m.name||"website visitor"),detail:clip(m.message||m.service||"Contact enquiry",42),when:date(m.created_at),kind:"message" as const,time:new Date(m.created_at).getTime()||0}))
  ].sort((a,b)=>b.time-a.time).slice(0,6);
  const cards=[
    {label:"Total orders",value:stats.orders,sub:"Imported Fiverr order records",icon:"↗",tone:"blue",href:"/admin/manage/orders"},
    {label:"Net earnings",value:money(stats.revenue),sub:"Recorded net order amount",icon:"$",tone:"mint",href:"/admin/analytics"},
    {label:"Portfolio content",value:stats.content,sub:"Editable content records",icon:"✎",tone:"violet",href:"/admin/content"},
    {label:"Unread messages",value:stats.unread,sub:`${stats.messages} total enquiries`,icon:"✉",tone:"amber",href:"/admin/manage/messages"}
  ];

  return <main className="dashv2">
    <style>{`
      .dashv2{min-height:100vh;background:var(--cms-bg,#f5f7fb);color:var(--cms-ink,#18243a);font-family:Inter,"DM Sans",ui-sans-serif,system-ui,sans-serif}
      .dashv2 *{box-sizing:border-box}
      .dash-top{height:68px;padding:0 clamp(18px,3vw,36px);display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid var(--cms-line,#e7ebf2)}
      .dash-crumb{font-size:11px;color:#9aa5b5}.dash-crumb b{color:#46536a}
      .dash-topright{display:flex;align-items:center;gap:14px}
      .dash-db{display:flex;align-items:center;gap:7px;border:1px solid #e8edf3;border-radius:30px;padding:7px 10px;font-size:10px;color:#728097}
      .dash-dot{width:7px;height:7px;border-radius:50%;background:#22a77b}.dash-dot.off{background:#d65d70}
      .dash-user{display:flex;align-items:center;gap:8px;color:#43516a;font-size:11px;font-weight:750}
      .dash-avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:11px;background:#eeedff;color:#635bdb;font-weight:850}
      .dash-logout{border:1px solid #e4e9f0;background:#fff;border-radius:8px;padding:8px 11px;color:#6d7a90;font-size:10px;font-weight:750;cursor:pointer}
      .dash-content{max-width:1500px;margin:auto;padding:26px clamp(16px,3vw,36px) 48px}
      .dash-hero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:145px;padding:25px 28px;border:1px solid #e7ebf3;border-radius:16px;background:linear-gradient(105deg,#fff 0%,#fff 68%,#f0efff 100%);box-shadow:0 7px 24px rgba(31,48,81,.045)}
      .dash-hero:after{content:"";position:absolute;width:220px;height:220px;right:6%;top:-130px;border:1px solid rgba(100,94,210,.14);border-radius:50%;box-shadow:0 0 0 25px rgba(100,94,210,.035),0 0 0 52px rgba(100,94,210,.025)}
      .dash-hero-copy,.dash-hero-actions{position:relative;z-index:1}
      .dash-eyebrow{font-size:9px;letter-spacing:1.7px;text-transform:uppercase;color:#716bd0;font-weight:850}
      .dash-hero h1{margin:8px 0 5px;color:#1c2940;font-size:26px;letter-spacing:-.9px}
      .dash-hero p{margin:0;color:#7c899d;font-size:11px;line-height:1.6}
      .dash-hero-actions{display:flex;gap:8px;flex-wrap:wrap}
      .dash-btn{display:inline-flex;align-items:center;gap:7px;text-decoration:none;border:1px solid #273b62;border-radius:9px;padding:10px 13px;background:#273b62;color:#fff;font-size:10px;font-weight:800}
      .dash-btn.secondary{background:#fff;color:#53627d;border-color:#e3e8f0}
      .dash-sectionhead{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:24px 0 11px}
      .dash-sectionhead h2{margin:0;color:#293750;font-size:14px}
      .dash-sectionhead p{margin:4px 0 0;color:#97a2b2;font-size:10px}
      .dash-link{color:#6968bd;text-decoration:none;font-size:10px;font-weight:800}
      .dash-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .dash-stat{display:block;min-width:0;padding:15px 16px;border:1px solid #e8edf4;border-top:3px solid #5684df;border-radius:13px;background:#fff;text-decoration:none;color:inherit;box-shadow:0 4px 15px rgba(26,43,77,.03);transition:.16s}
      .dash-stat:hover{transform:translateY(-2px);box-shadow:0 10px 23px rgba(26,43,77,.075)}
      .dash-stat.mint{border-top-color:#24a77b}.dash-stat.violet{border-top-color:#8873db}.dash-stat.amber{border-top-color:#e3a04e}
      .dash-stathead{display:flex;align-items:center;justify-content:space-between;color:#8390a4;font-size:10px;font-weight:750}
      .dash-staticon{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:#eaf1ff;color:#4778d3;font-size:13px;font-weight:850}
      .dash-stat.mint .dash-staticon{background:#e5f7ef;color:#159267}.dash-stat.violet .dash-staticon{background:#f0edff;color:#7663ca}.dash-stat.amber .dash-staticon{background:#fff2e2;color:#c7802e}
      .dash-statvalue{margin:10px 0 3px;color:#202c42;font-size:23px;font-weight:850;letter-spacing:-.7px}
      .dash-statsub{color:#a0aaba;font-size:9px}
      .dash-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,.85fr);gap:13px;margin-top:14px}
      .dash-panel{min-width:0;overflow:hidden;border:1px solid #e8edf4;border-radius:13px;background:#fff;box-shadow:0 4px 15px rgba(26,43,77,.03)}
      .dash-panelhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:15px 17px;border-bottom:1px solid #eff1f5}
      .dash-panelhead h3{margin:0;color:#293750;font-size:12px}
      .dash-panelhead small{color:#9aa5b4;font-size:9px}
      .dash-chart{padding:14px 17px 12px}
      .dash-chartrow{display:grid;grid-template-columns:52px 1fr;gap:9px;align-items:end;margin:9px 0}
      .dash-chartlabel{padding-bottom:2px;color:#8995a8;font-size:9px}
      .dash-bartrack{height:25px;overflow:hidden;border-radius:6px;background:#f1f3f9}
      .dash-bar{height:100%;min-width:2px;border-radius:6px;background:linear-gradient(90deg,#6575d6,#8e84df)}
      .dash-chartmeta{display:flex;justify-content:space-between;gap:10px;margin:12px 0 0 61px;color:#9aa5b4;font-size:9px}
      .dash-sales{display:flex;align-items:center;gap:17px;padding:17px}
      .dash-donut{width:126px;height:126px;flex:0 0 126px;display:grid;place-items:center;border-radius:50%;background:conic-gradient(${donut||"#e9edf4 0% 100%"})}
      .dash-donutinner{width:82px;height:82px;display:grid;place-items:center;align-content:center;border-radius:50%;background:white;text-align:center}
      .dash-donutinner b{color:#27344c;font-size:17px}.dash-donutinner small{margin-top:3px;color:#9aa5b4;font-size:8px}
      .dash-legend{display:grid;gap:9px;min-width:0}.dash-legendrow{display:flex;align-items:center;gap:7px;color:#65728a;font-size:9px}.dash-legendrow b{margin-left:auto;color:#3d4b63}
      .dash-legenddot{width:7px;height:7px;flex:0 0 7px;border-radius:50%}
      .dash-bottom{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.9fr) minmax(220px,.8fr);gap:13px;margin-top:14px}
      .dash-tablewrap{overflow:auto} .dash-table{width:100%;border-collapse:collapse;white-space:nowrap;text-align:left}
      .dash-table th{padding:10px 12px;background:#fafbfe;color:#9aa5b4;font-size:8px;text-transform:uppercase;letter-spacing:.6px}
      .dash-table td{padding:11px 12px;border-top:1px solid #f0f2f6;color:#68758a;font-size:9px}
      .dash-table td strong{color:#39465b}.dash-pill{display:inline-block;padding:4px 7px;border-radius:20px;background:#eef1f6;color:#718097;font-size:8px;font-weight:800}
      .dash-pill.good{background:#e7f7ef;color:#19885c}.dash-pill.wait{background:#fff3e2;color:#b77b2d}
      .dash-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px}
      .dash-quick a{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid #edf0f5;border-radius:9px;text-decoration:none;color:#46536b;background:#fff;transition:.16s}
      .dash-quick a:hover{background:#f8f8ff;border-color:#dcd9fb;transform:translateY(-1px)}
      .dash-quickicon{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:8px;background:#f0efff;color:#6963c7;font-size:12px}
      .dash-quick b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.dash-quick small{display:block;margin-top:3px;color:#a0aaba;font-size:8px}
      .dash-activity{padding:5px 15px 8px}.dash-event{display:flex;gap:9px;padding:10px 0;border-bottom:1px solid #f0f2f6}.dash-event:last-child{border:0}
      .dash-eventicon{width:27px;height:27px;flex:0 0 27px;display:grid;place-items:center;border-radius:9px;background:#eaf1ff;color:#4778d3;font-size:11px}
      .dash-eventicon.message{background:#f0edff;color:#7663ca}.dash-eventbody{min-width:0}.dash-eventbody b{display:block;color:#46536a;font-size:9px}.dash-eventbody small{display:block;margin-top:3px;color:#9aa5b4;font-size:8px}.dash-eventbody p{margin:4px 0 0;color:#8793a5;font-size:8px;line-height:1.4}
      .dash-empty{padding:24px 15px;text-align:center;color:#9aa5b4;font-size:10px}
      .dash-foot{text-align:right;margin-top:12px;color:#a0aaba;font-size:8px}
      @media(max-width:1100px){.dash-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.dash-bottom{grid-template-columns:1fr 1fr}.dash-bottom>.dash-panel:last-child{grid-column:1/-1}}
      @media(max-width:760px){.dash-top{height:56px;padding:0 13px}.dash-content{padding:16px 13px 32px}.dash-hero{display:block;padding:20px 17px}.dash-hero h1{font-size:21px}.dash-hero-actions{margin-top:15px}.dash-grid,.dash-bottom{grid-template-columns:1fr}.dash-bottom>.dash-panel:last-child{grid-column:auto}.dash-db{font-size:0;padding:8px}.dash-user span{display:none}.dash-logout{padding:7px 8px}.dash-sales{justify-content:flex-start}}
      @media(max-width:390px){.dash-stats{gap:8px}.dash-stat{padding:12px}.dash-statvalue{font-size:19px}.dash-stathead{font-size:9px}.dash-quick{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){.dashv2 *{transition:none!important}}

      /* Version 2 visual refinement: improve hierarchy and readability without changing the theme */
      .dash-content{max-width:1500px!important;padding:30px clamp(20px,3vw,40px) 52px!important}
      .dash-top{height:72px!important;padding:0 clamp(20px,3vw,40px)!important}
      .dash-crumb{font-size:12px!important}
      .dash-db{font-size:11px!important;padding:8px 12px!important}
      .dash-user{font-size:12px!important}
      .dash-avatar{width:36px!important;height:36px!important}
      .dash-logout{font-size:11px!important;padding:9px 13px!important}
      .dash-hero{min-height:168px!important;padding:30px 34px!important;border-radius:18px!important;box-shadow:0 10px 30px rgba(31,48,81,.055)!important}
      .dash-eyebrow{font-size:10px!important;letter-spacing:1.9px!important}
      .dash-hero h1{font-size:clamp(25px,2.2vw,32px)!important;margin:10px 0 7px!important}
      .dash-hero p{font-size:13px!important}
      .dash-btn{font-size:12px!important;padding:12px 16px!important;border-radius:10px!important}
      .dash-sectionhead{margin:30px 0 14px!important}
      .dash-sectionhead h2{font-size:18px!important}
      .dash-sectionhead p{font-size:12px!important}
      .dash-link{font-size:12px!important}
      .dash-stats{gap:16px!important}
      .dash-stat{padding:19px 20px!important;border-radius:15px!important;box-shadow:0 6px 20px rgba(26,43,77,.045)!important}
      .dash-stathead{font-size:12px!important}
      .dash-staticon{width:38px!important;height:38px!important;font-size:16px!important;border-radius:11px!important}
      .dash-statvalue{font-size:30px!important;margin:13px 0 5px!important}
      .dash-statsub{font-size:11px!important}
      .dash-grid{gap:16px!important;margin-top:18px!important}
      .dash-panel{border-radius:15px!important;box-shadow:0 6px 20px rgba(26,43,77,.04)!important}
      .dash-panelhead{padding:18px 20px!important}
      .dash-panelhead h3{font-size:14px!important}
      .dash-panelhead small{font-size:11px!important}
      .dash-chart{padding:18px 20px 16px!important}
      .dash-chartrow{grid-template-columns:62px 1fr!important;gap:12px!important;margin:12px 0!important}
      .dash-chartlabel{font-size:11px!important}
      .dash-bartrack{height:30px!important;border-radius:8px!important}
      .dash-chartmeta{margin:15px 0 0 74px!important;font-size:11px!important}
      .dash-sales{gap:22px!important;padding:22px!important}
      .dash-donut{width:148px!important;height:148px!important;flex-basis:148px!important}
      .dash-donutinner{width:96px!important;height:96px!important}
      .dash-donutinner b{font-size:21px!important}
      .dash-donutinner small{font-size:10px!important}
      .dash-legend{gap:12px!important}
      .dash-legendrow{font-size:11px!important}
      .dash-legenddot{width:9px!important;height:9px!important;flex-basis:9px!important}
      .dash-bottom{gap:16px!important;margin-top:18px!important}
      .dash-table th{font-size:10px!important;padding:13px 14px!important}
      .dash-table td{font-size:11px!important;padding:14px!important}
      .dash-pill{font-size:10px!important;padding:5px 9px!important}
      .dash-quick{gap:10px!important;padding:15px!important}
      .dash-quick a{padding:13px!important;gap:11px!important;border-radius:11px!important}
      .dash-quickicon{width:34px!important;height:34px!important;flex-basis:34px!important;font-size:15px!important}
      .dash-quick b{font-size:11px!important}
      .dash-quick small{font-size:10px!important}
      .dash-activity{padding:7px 19px 12px!important}
      .dash-event{gap:11px!important;padding:13px 0!important}
      .dash-eventicon{width:33px!important;height:33px!important;flex-basis:33px!important;font-size:13px!important}
      .dash-eventbody b{font-size:11px!important}
      .dash-eventbody small,.dash-eventbody p{font-size:10px!important}
      .dash-empty{font-size:12px!important;padding:30px 18px!important}
      .dash-foot{font-size:10px!important;margin-top:16px!important}
      @media(max-width:760px){
        .dash-content{padding:18px 14px 36px!important}
        .dash-top{height:60px!important;padding:0 14px!important}
        .dash-hero{padding:22px 19px!important;min-height:0!important}
        .dash-hero h1{font-size:23px!important}
        .dash-stats{gap:10px!important}
        .dash-stat{padding:14px!important}
        .dash-statvalue{font-size:23px!important}
        .dash-grid,.dash-bottom{gap:12px!important}
        .dash-sales{padding:17px!important;gap:15px!important}
        .dash-donut{width:112px!important;height:112px!important;flex-basis:112px!important}
        .dash-donutinner{width:74px!important;height:74px!important}
      }

      /* Full V2 dashboard composition */
      .dashv2{background:radial-gradient(ellipse at 92% 0%,rgba(111,104,224,.10),transparent 34%),#f4f6fb!important}
      .dash-content{max-width:1600px!important;padding:34px clamp(22px,3.2vw,48px) 58px!important}
      .dash-top{height:76px!important;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(14px)}
      .dash-hero{min-height:190px!important;padding:36px 40px!important;border:1px solid #e4e8f3!important;border-radius:22px!important;background:linear-gradient(112deg,#fff 0%,#fff 56%,#f0efff 100%)!important;box-shadow:0 14px 38px rgba(33,48,86,.07)!important}
      .dash-hero:after{width:280px!important;height:280px!important;right:8%!important;top:-160px!important;box-shadow:0 0 0 32px rgba(100,94,210,.045),0 0 0 66px rgba(100,94,210,.028)!important}
      .dash-eyebrow{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:7px 11px!important;border-radius:30px!important;background:#f0efff!important;color:#655dcc!important;font-size:10px!important;letter-spacing:1.5px!important}
      .dash-hero h1{font-size:clamp(28px,2.5vw,38px)!important;letter-spacing:-1.3px!important;margin:13px 0 8px!important}
      .dash-hero p{font-size:14px!important;color:#77849a!important}
      .dash-btn{padding:13px 17px!important;font-size:12px!important;box-shadow:0 6px 14px rgba(39,59,98,.12)!important}
      .dash-btn.secondary{box-shadow:none!important}
      .dash-sectionhead{margin:34px 0 16px!important}
      .dash-sectionhead h2{font-size:20px!important;letter-spacing:-.45px!important}
      .dash-sectionhead p{font-size:12px!important}
      .dash-stats{gap:17px!important}
      .dash-stat{position:relative!important;min-height:142px!important;padding:21px 22px!important;border:1px solid #e7ebf3!important;border-top:0!important;border-radius:17px!important;box-shadow:0 8px 24px rgba(31,48,81,.045)!important}
      .dash-stat:before{content:"";position:absolute;inset:0 auto 0 0;width:4px;border-radius:17px 0 0 17px;background:#5684df}
      .dash-stat.mint:before{background:#24a77b}.dash-stat.violet:before{background:#8873db}.dash-stat.amber:before{background:#e3a04e}
      .dash-stat:hover{transform:translateY(-4px)!important;box-shadow:0 15px 30px rgba(31,48,81,.09)!important}
      .dash-stathead{font-size:12px!important;color:#77849a!important}
      .dash-staticon{width:42px!important;height:42px!important;border-radius:13px!important;font-size:17px!important}
      .dash-statvalue{font-size:32px!important;margin:13px 0 5px!important}
      .dash-statsub{font-size:11px!important}
      .dash-grid{grid-template-columns:minmax(0,1.55fr) minmax(330px,.9fr)!important;gap:18px!important;margin-top:19px!important}
      .dash-panel{border:1px solid #e6eaf2!important;border-radius:17px!important;box-shadow:0 8px 24px rgba(31,48,81,.045)!important}
      .dash-panelhead{min-height:68px!important;padding:18px 21px!important}
      .dash-panelhead h3{font-size:15px!important;letter-spacing:-.2px!important}
      .dash-panelhead small{display:block!important;margin-top:5px!important;font-size:10px!important;color:#9aa5b4!important}
      .dash-chart{padding:19px 22px 18px!important}
      .dash-chartrow{grid-template-columns:65px 1fr!important;gap:13px!important;margin:13px 0!important}
      .dash-chartlabel{font-size:11px!important}
      .dash-bartrack{height:31px!important;border-radius:9px!important;background:#f0f2f8!important}
      .dash-bar{background:linear-gradient(90deg,#625fd0 0%,#8e83e7 100%)!important;box-shadow:0 4px 9px rgba(103,96,211,.16)!important}
      .dash-chartmeta{margin:18px 0 0 78px!important;padding-top:13px!important;border-top:1px solid #eff1f6!important;font-size:11px!important}
      .dash-sales{min-height:235px!important;justify-content:center!important;gap:24px!important;padding:24px!important}
      .dash-donut{width:158px!important;height:158px!important;flex-basis:158px!important;box-shadow:0 8px 24px rgba(60,71,120,.08)!important}
      .dash-donutinner{width:104px!important;height:104px!important;box-shadow:0 2px 9px rgba(31,48,81,.06)!important}
      .dash-donutinner b{font-size:24px!important}
      .dash-legend{gap:14px!important}
      .dash-legendrow{font-size:11px!important}
      .dash-bottom{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:18px!important;margin-top:19px!important}
      .dash-orders-panel{margin-top:19px!important}
      .dash-tablewrap{overflow-x:auto!important}
      .dash-table{min-width:760px!important}
      .dash-table th{padding:15px 17px!important;font-size:10px!important}
      .dash-table td{padding:16px 17px!important;font-size:11px!important}
      .dash-table tbody tr:hover{background:#fafaff!important}
      .dash-pill{padding:6px 10px!important;font-size:9px!important;border-radius:30px!important}
      .dash-quick{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:11px!important;padding:17px!important}
      .dash-quick a{position:relative!important;min-height:76px!important;padding:13px!important;border:1px solid #edf0f6!important;border-radius:12px!important;background:linear-gradient(145deg,#fff,#fbfbff)!important}
      .dash-quick a:hover{border-color:#dcd9fb!important;background:#f8f7ff!important}
      .dash-quickicon{width:38px!important;height:38px!important;flex-basis:38px!important;border-radius:11px!important;font-size:16px!important}
      .dash-quick b{font-size:11px!important;color:#35435c!important}
      .dash-quick small{font-size:9px!important;line-height:1.4!important}
      .dash-quickarrow{margin-left:auto;color:#9a94dc;font-size:14px}
      .dash-panel-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#f0efff;color:#7068cf;font-size:14px}
      .dash-activity{padding:8px 21px 12px!important}
      .dash-event{gap:12px!important;padding:14px 0!important}
      .dash-eventicon{width:36px!important;height:36px!important;flex-basis:36px!important;border-radius:11px!important}
      .dash-eventbody b{font-size:11px!important;color:#3e4b63!important}
      .dash-eventbody small,.dash-eventbody p{font-size:10px!important}
      .dash-foot{padding-top:4px!important;font-size:10px!important}
      @media(max-width:1120px){
        .dash-grid{grid-template-columns:minmax(0,1.2fr) minmax(280px,.9fr)!important}
        .dash-bottom{grid-template-columns:1fr!important}
      }
      @media(max-width:760px){
        .dash-content{padding:18px 14px 36px!important}
        .dash-top{height:60px!important}
        .dash-hero{min-height:0!important;padding:23px 20px!important;border-radius:17px!important}
        .dash-hero h1{font-size:24px!important}
        .dash-hero p{font-size:12px!important}
        .dash-sectionhead{margin:25px 0 13px!important}
        .dash-sectionhead h2{font-size:17px!important}
        .dash-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        .dash-stat{min-height:122px!important;padding:14px!important}
        .dash-statvalue{font-size:23px!important}
        .dash-statsub{font-size:9px!important}
        .dash-grid,.dash-bottom{grid-template-columns:1fr!important;gap:12px!important}
        .dash-sales{min-height:0!important;justify-content:flex-start!important;padding:18px!important}
        .dash-donut{width:116px!important;height:116px!important;flex-basis:116px!important}
        .dash-donutinner{width:76px!important;height:76px!important}
        .dash-quick{grid-template-columns:1fr 1fr!important}
      }
      @media(max-width:390px){.dash-quick{grid-template-columns:1fr!important}}
    `}</style>
    <header className="dash-top"><div className="dash-crumb">WORKSPACE&nbsp; / &nbsp;<b>Dashboard</b></div><div className="dash-topright"><div className="dash-db"><span className={"dash-dot "+(connected?"":"off")}/>{connected?"Database connected":"Database unavailable"}</div><div className="dash-user"><div className="dash-avatar">{session.username.slice(0,1).toUpperCase()}</div><span>{session.username}</span></div><form action="/api/admin/logout" method="post"><button className="dash-logout">Sign out</button></form></div></header>
    <section className="dash-content">
      <div className="dash-hero"><div className="dash-hero-copy"><div className="dash-eyebrow">YOUR CONTROL CENTER</div><h1>Welcome back, {session.username} ✦</h1><p>Here’s what’s happening across your portfolio and business workspace.</p></div><div className="dash-hero-actions"><Link className="dash-btn" href="/admin/analytics">▥ View analytics →</Link><Link className="dash-btn secondary" href="/admin/content">＋ Add content</Link></div></div>
      <div className="dash-sectionhead"><div><h2>Business overview</h2><p>Live figures from your connected database</p></div><Link className="dash-link" href="/admin/analytics">Full reports →</Link></div>
      <div className="dash-stats">{cards.map(c=><Link className={"dash-stat "+c.tone} href={c.href} key={c.label}><div className="dash-stathead"><span>{c.label}</span><span className="dash-staticon">{c.icon}</span></div><div className="dash-statvalue">{c.value}</div><div className="dash-statsub">{c.sub}</div></Link>)}</div>
      <div className="dash-grid">
        <section className="dash-panel"><div className="dash-panelhead"><h3>Analytics overview</h3><small>Monthly net earnings · last 6 months</small></div><div className="dash-chart">{months.length?months.map(m=><div className="dash-chartrow" key={m.month}><span className="dash-chartlabel">{m.month}</span><div className="dash-bartrack"><div className="dash-bar" style={{width:Math.max(1,(Number(m.net)||0)/maxMonthly*100)+"%"}}/></div></div>):<div className="dash-empty">No monthly order history is available yet.</div>}<div className="dash-chartmeta"><span>{months.reduce((n,m)=>n+Number(m.orders||0),0)} orders in this period</span><strong>{money(months.reduce((n,m)=>n+Number(m.net||0),0))}</strong></div></div></section>
        <section className="dash-panel"><div className="dash-panelhead"><h3>Sales performance</h3><small>Imported order records</small></div>{statuses.length?<div className="dash-sales"><div className="dash-donut"><div className="dash-donutinner"><b>{stats.orders}</b><small>Total orders</small></div></div><div className="dash-legend">{statuses.slice(0,6).map((x,i)=><div className="dash-legendrow" key={x.status}><span className="dash-legenddot" style={{background:palette[i%palette.length]}}/><span>{clip(x.status||"Unknown",17)}</span><b>{x.total}</b></div>)}</div></div>:<div className="dash-empty">No order status data available.</div>}</section>
      </div>
      <section className="dash-panel dash-orders-panel">
        <div className="dash-panelhead"><div><h3>Recent orders</h3><small>Your latest Fiverr activity</small></div><Link className="dash-link" href="/admin/manage/orders">View all orders →</Link></div>
        <div className="dash-tablewrap"><table className="dash-table"><thead><tr><th>Order ID</th><th>Client</th><th>Project</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><strong>#{clip(o.order_id,15)}</strong></td><td>{clip(o.client_username,18)}</td><td>{clip(o.project_title,32)}</td><td><strong>{money(o.amount)}</strong></td><td><span className={"dash-pill "+(/complete|delivered|done/i.test(o.status)?"good":/pending|progress/i.test(o.status)?"wait":"")}>{clip(o.status||"Unknown",15)}</span></td><td>{date(o.created_at)}</td></tr>)}</tbody></table>{!orders.length&&<div className="dash-empty">No order records found.</div>}</div>
      </section>
      <div className="dash-bottom">
        <section className="dash-panel"><div className="dash-panelhead"><div><h3>Quick actions</h3><small>Frequently used workspace shortcuts</small></div><span className="dash-panel-mark">✦</span></div><div className="dash-quick">{nav.map((n,i)=><Link href={n.href} key={n.href+"-"+i}><span className="dash-quickicon">{n.icon}</span><span><b>{n.label}</b><small>{n.hint}</small></span><span className="dash-quickarrow">↗</span></Link>)}</div></section>
        <section className="dash-panel"><div className="dash-panelhead"><div><h3>Recent activity</h3><small>Latest orders and website enquiries</small></div><span className="dash-panel-mark">◷</span></div><div className="dash-activity">{activity.map(a=><article className="dash-event" key={a.key}><span className={"dash-eventicon "+(a.kind==="message"?"message":"")}>{a.kind==="message"?"✉":"↗"}</span><div className="dash-eventbody"><b>{a.title||"New activity"}</b><small>{a.when}</small><p>{a.detail}</p></div></article>)}{!activity.length&&<div className="dash-empty">New orders and messages will appear here.</div>}</div></section>
      </div>
      <div className="dash-foot">JS SALMAN · Secure admin workspace · Live database figures</div>
    </section>
  </main>;
}
