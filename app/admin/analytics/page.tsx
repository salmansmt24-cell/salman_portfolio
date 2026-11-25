import Link from "next/link";import {redirect} from "next/navigation";import {neon} from "@neondatabase/serverless";import {getAdminSession} from "@/lib/admin-auth";
export const dynamic="force-dynamic";export const runtime="nodejs";
const usd=(v:any)=>"$"+Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function AnalyticsPage(){
 const s=await getAdminSession();if(!s)redirect("/admin/login");if(!process.env.LEGACY_DATABASE_URL)throw new Error("DATABASE_URL missing");
 const sql=neon(process.env.LEGACY_DATABASE_URL);
 const [totals,months,statuses]=await Promise.all([
 sql`SELECT COUNT(*)::int AS orders,COALESCE(SUM(gross_amount),SUM(amount),0)::float AS gross,COALESCE(SUM(net_amount),0)::float AS net,COALESCE(AVG(amount),0)::float AS average,COUNT(*) FILTER(WHERE LOWER(status) LIKE '%complete%' OR LOWER(status) LIKE '%deliver%')::int AS completed FROM cms_fiverr_orders`,
 sql`SELECT TO_CHAR(COALESCE(lead_date,created_at::date),'YYYY-MM') AS month,COUNT(*)::int AS orders,COALESCE(SUM(net_amount),0)::float AS net FROM cms_fiverr_orders WHERE COALESCE(lead_date,created_at::date)>=CURRENT_DATE-INTERVAL '11 months' GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
 sql`SELECT status,COUNT(*)::int AS total FROM cms_fiverr_orders GROUP BY status ORDER BY total DESC`]);
 const t=totals[0] as any;
 const cards=[["Total orders",t.orders],["Gross sales",usd(t.gross)],["Net earnings",usd(t.net)],["Average order",usd(t.average)],["Completed",t.completed]];
 return <main className="content-management-page"><header className="content-management-header"><div className="content-header-brand"><span className="content-brand-mark">S</span><div><strong>Portfolio CMS</strong><small>Analytics · Signed in as {s.username}</small></div></div><Link href="/admin" className="content-back-link">← Dashboard</Link></header>
 <section className="content-management-wrap"><div className="content-hero"><div className="content-hero-copy"><span className="content-eyebrow">PERFORMANCE OVERVIEW</span><h1>Analytics & insights</h1><p>Understand order volume, earnings and delivery performance from your imported Fiverr records.</p></div><div className="content-hero-badge"><span className="content-live-dot"/> Live reporting</div></div>
 <div className="content-summary analytics-summary">{cards.map(([label,value],i)=><div className="content-summary-item" key={String(label)}><span className="content-summary-icon">{["▤","$","↗","◷","✓"][i]}</span><div><strong>{value}</strong><small>{label}</small></div></div>)}</div>
 <div className="content-editor-heading"><div><h2>Revenue & order insights</h2><p>Monthly net earnings and current order status distribution.</p></div></div>
 <div className="analytics-panels"><section className="analytics-panel"><h2>Monthly net earnings</h2>{months.map((m:any)=><div key={m.month} className="analytics-month"><div><strong>{m.month}</strong><span>{usd(m.net)} · {m.orders} orders</span></div><div className="analytics-track"><div style={{width:(Math.max(0,Number(m.net))/Math.max(1,...months.map((x:any)=>Number(x.net)))*100)+"%"}}/></div></div>)}</section><section className="analytics-panel"><h2>Order status breakdown</h2>{statuses.map((x:any)=><div key={x.status} className="analytics-status"><span>{x.status}</span><strong>{x.total}</strong></div>)}</section></div>
 </section></main>;
}
