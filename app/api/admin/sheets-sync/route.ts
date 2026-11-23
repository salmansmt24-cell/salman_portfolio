import {NextRequest,NextResponse} from "next/server";import {neon} from "@neondatabase/serverless";import {getAdminSession} from "@/lib/admin-auth";
export const runtime="nodejs";
const str=(v:any,max=255)=>String(v??"").trim().slice(0,max);
const date=(v:any,withTime=false)=>{const s=str(v,30);if(!s)return null;const p=withTime?/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/:/^\d{4}-\d{2}-\d{2}$/;return p.test(s)?s:null};
export async function POST(req:NextRequest){if(!(await getAdminSession()))return NextResponse.json({error:"Unauthorized"},{status:401});const origin=req.headers.get("origin"),host=req.headers.get("host");if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Rejected"},{status:403})}catch{return NextResponse.json({error:"Rejected"},{status:403})}}
let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}if(b?.success!==true||!Array.isArray(b.rows)||b.rows.length===0||b.rows.length>=1000)return NextResponse.json({error:"Invalid or incomplete Sheet snapshot. Nothing was changed."},{status:400});
const seenSales=new Set<string>(),seenOrders=new Set<string>();for(const r of b.rows){const sid=str(r?.sales_id,100),oid=str(r?.order_id,100);if(!sid||!oid||seenSales.has(sid)||seenOrders.has(oid))return NextResponse.json({error:"Missing or duplicate Sales ID / Order ID. Nothing was changed."},{status:400});seenSales.add(sid);seenOrders.add(oid);for(const k of ["sales_amount","other_amount","delivered_amount"]){const n=Number(r[k]??0);if(!Number.isFinite(n)||n<0||n>9999999999.99)return NextResponse.json({error:"Invalid amount in Sheet. Nothing was changed."},{status:400})}}
if(!process.env.LEGACY_DATABASE_URL)return NextResponse.json({error:"Database unavailable"},{status:503});
try{const sql=neon(process.env.LEGACY_DATABASE_URL);let added=0,updated=0,unchanged=0,skipped=0;
for(const r of b.rows){const sid=str(r.sales_id,100),oid=str(r.order_id,100),buyer=str(r.buyer,150),profile=str(r.account,150),dept=str(r.department,100),team=str(r.assigned_team,255),status=str(r.status||"Pending",30)||"Pending",other=Number(r.other_amount||0),net=Number(r.sales_amount||0),delivered=Number(r.delivered_amount||0),day=date(r.order_date),deadline=date(r.deadline,true),title=team||buyer;
const source={source:"google_sheet_v4_1",sales_id:sid,order_time:str(r.order_time,80),sales_person:str(r.sales_person,150),department:dept,phase:str(r.phase,100),assigned_team:team,sales_type:str(r.sales_type,80),delivered_amount:delivered,other_amount:other,sales_amount:net};
const notes="[GOOGLE_SHEET_SYNC] "+JSON.stringify(source);
const category=/shopify/i.test(dept)?"Shopify":/wordpress/i.test(dept)?"WordPress":/squarespace/i.test(dept)?"Squarespace":/webflow/i.test(dept)?"WebFlow":/wix/i.test(dept)?"Wix":"General";
const found=await sql`SELECT id,order_id,notes FROM cms_fiverr_orders WHERE sales_id=${sid} OR order_id=${oid} LIMIT 2`;
if(found.length>1){skipped++;continue}
const old=found[0];
if(old){if(old.order_id!==oid){skipped++;continue}if(!String(old.notes||"").startsWith("[GOOGLE_SHEET_SYNC]")&&!String(old.notes||"").startsWith("Sales ID: "+sid+" |")){skipped++;continue}
await sql`UPDATE cms_fiverr_orders SET client_username=${buyer},client_company=${buyer},profile_name=${profile},project_title=${title},category=${category},amount=${other},fiverr_fee=0,gross_amount=${other},net_amount=${net},start_date=${day},lead_date=${day},deadline=${deadline},status=${status},notes=${notes},updated_at=NOW() WHERE id=${old.id}`;updated++;
}else{await sql`INSERT INTO cms_fiverr_orders(sales_id,order_id,sales_order_number,client_username,client_company,profile_name,project_title,category,amount,fiverr_fee,gross_amount,net_amount,start_date,lead_date,deadline,status,notes,order_url) VALUES(${sid},${oid},${oid},${buyer},${buyer},${profile},${title},${category},${other},0,${other},${net},${day},${day},${deadline},${status},${notes},'')`;added++}
}
await sql`INSERT INTO cms_fv_sync_log(added,updated,deleted,unchanged,total) VALUES(${added},${updated},0,${unchanged+skipped},${b.rows.length})`;
return NextResponse.json({ok:true,added,updated,unchanged,skipped,deleted:0,total:b.rows.length,source_tabs:b.source_tabs||[]});
}catch(e){console.error("Google Sheets sync failed",e);return NextResponse.json({error:"Sync stopped. Some rows may already have been processed; run sync again to reconcile safely."},{status:500})}}
