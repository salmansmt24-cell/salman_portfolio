import { NextRequest,NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getAdminSession } from "@/lib/admin-auth";
import { isPrivateVaultUnlocked } from "@/lib/private-vault";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const entities=new Set(["orders","profiles","messages","templates"]);
async function guard(req:NextRequest){if(!(await getAdminSession()))return false;const origin=req.headers.get("origin"),host=req.headers.get("host");if(origin&&host){try{if(new URL(origin).host!==host)return false}catch{return false}}return true}
function text(v:unknown,max:number,required=false){if(typeof v!=="string")return required?null:"";const s=v.trim();return s.length<=max&&( !required||!!s)?s:null}
function db(){if(!process.env.DATABASE_URL)throw new Error("Database not configured");return neon(process.env.DATABASE_URL)}
export async function GET(req:NextRequest){
 if(!(await guard(req)))return NextResponse.json({error:"Unauthorized"},{status:403});
 const entity=req.nextUrl.searchParams.get("entity")||"";if(!entities.has(entity))return NextResponse.json({error:"Invalid entity"},{status:400});
 if(entity==="templates" && !(await isPrivateVaultUnlocked()))return NextResponse.json({error:"Unlock the private template vault first."},{status:423});
 try{const sql=db();let rows:any[]=[];
 if(entity==="orders")rows=await sql`SELECT id,order_id,client_username,project_title,category,amount,fiverr_fee,status,progress,order_url,notes,client_company,profile_name,net_amount,deadline,created_at FROM cms_fiverr_orders ORDER BY created_at DESC,id DESC LIMIT 500`;
 if(entity==="profiles")rows=await sql`SELECT id,username,created_at FROM cms_fiverr_profiles ORDER BY username ASC`;
 if(entity==="messages")rows=await sql`SELECT id,name,email,service,message,is_read,created_at FROM cms_messages ORDER BY created_at DESC,id DESC LIMIT 500`;
 if(entity==="templates")rows=await sql`SELECT id,title,category,body,created_at,updated_at FROM cms_private_templates ORDER BY updated_at DESC,id DESC`;
 return NextResponse.json({ok:true,items:rows});
 }catch(e){console.error("Admin list failed",e);return NextResponse.json({error:"Could not load records."},{status:500})}
}
export async function POST(req:NextRequest){
 if(!(await guard(req)))return NextResponse.json({error:"Unauthorized"},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const entity=String(b.entity||"");if(!entities.has(entity))return NextResponse.json({error:"Invalid entity"},{status:400});if(entity==="templates"&&!(await isPrivateVaultUnlocked()))return NextResponse.json({error:"Unlock the private template vault first."},{status:423});
 try{const sql=db();let rows:any[]=[];
 if(entity==="orders"){
 const order_id=text(b.order_id,100,true),client=text(b.client_username,150,true),title=text(b.project_title,255,true),category=text(b.category||"General",100,true),status=text(b.status||"Pending",30,true),url=text(b.order_url||"",500),notes=text(b.notes||"",20000),amount=Number(b.amount||0),fee=Number(b.fiverr_fee||0),progress=Number(b.progress||0);
 if(!order_id||!client||!title||!category||!status||url===null||notes===null||![amount,fee,progress].every(Number.isFinite)||amount<0||fee<0||progress<0||progress>100)return NextResponse.json({error:"Check required fields and numeric values."},{status:400});
 rows=await sql`INSERT INTO cms_fiverr_orders(order_id,client_username,project_title,category,status,amount,fiverr_fee,progress,order_url,notes,net_amount) VALUES(${order_id},${client},${title},${category},${status},${amount},${fee},${progress},${url},${notes},${amount-fee}) RETURNING id,order_id,client_username,project_title,category,amount,fiverr_fee,status,progress,order_url,notes,net_amount,created_at`;
 }
 if(entity==="profiles"){const username=text(b.username,150,true);if(!username)return NextResponse.json({error:"Username is required."},{status:400});rows=await sql`INSERT INTO cms_fiverr_profiles(username) VALUES(${username}) RETURNING id,username,created_at`;}
 if(entity==="templates"){const title=text(b.title,200,true),category=text(b.category||"General",100,true),body=text(b.body,50000,true);if(!title||!category||!body)return NextResponse.json({error:"Title, category and body are required."},{status:400});rows=await sql`INSERT INTO cms_private_templates(title,category,body) VALUES(${title},${category},${body}) RETURNING id,title,category,body,created_at,updated_at`;}
 return NextResponse.json({ok:true,item:rows[0]});
 }catch(e){console.error("Admin create failed",e);return NextResponse.json({error:"Could not create record. Check for duplicate IDs or usernames."},{status:400})}
}
export async function PUT(req:NextRequest){
 if(!(await guard(req)))return NextResponse.json({error:"Unauthorized"},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const entity=String(b.entity||""),id=Number(b.id);if(!entities.has(entity)||!Number.isInteger(id)||id<1)return NextResponse.json({error:"Invalid request"},{status:400});if(entity==="templates"&&!(await isPrivateVaultUnlocked()))return NextResponse.json({error:"Unlock the private template vault first."},{status:423});
 try{const sql=db();let rows:any[]=[];
 if(entity==="orders"){const client=text(b.client_username,150,true),title=text(b.project_title,255,true),category=text(b.category||"General",100,true),status=text(b.status,30,true),url=text(b.order_url||"",500),notes=text(b.notes||"",20000),amount=Number(b.amount),fee=Number(b.fiverr_fee),progress=Number(b.progress);if(!client||!title||!category||!status||url===null||notes===null||![amount,fee,progress].every(Number.isFinite)||amount<0||fee<0||progress<0||progress>100)return NextResponse.json({error:"Invalid order fields."},{status:400});rows=await sql`UPDATE cms_fiverr_orders SET client_username=${client},project_title=${title},category=${category},status=${status},amount=${amount},fiverr_fee=${fee},net_amount=${amount-fee},progress=${progress},order_url=${url},notes=${notes},updated_at=NOW() WHERE id=${id} RETURNING id,order_id,client_username,project_title,category,amount,fiverr_fee,status,progress,order_url,notes,net_amount,created_at`;}
 if(entity==="profiles"){const username=text(b.username,150,true);if(!username)return NextResponse.json({error:"Username is required."},{status:400});rows=await sql`UPDATE cms_fiverr_profiles SET username=${username} WHERE id=${id} RETURNING id,username,created_at`;}
 if(entity==="messages"){if(typeof b.is_read!=="boolean")return NextResponse.json({error:"Invalid read status."},{status:400});rows=await sql`UPDATE cms_messages SET is_read=${b.is_read} WHERE id=${id} RETURNING id,name,email,service,message,is_read,created_at`;}
 if(entity==="templates"){const title=text(b.title,200,true),category=text(b.category||"General",100,true),body=text(b.body,50000,true);if(!title||!category||!body)return NextResponse.json({error:"Invalid template fields."},{status:400});rows=await sql`UPDATE cms_private_templates SET title=${title},category=${category},body=${body},updated_at=NOW() WHERE id=${id} RETURNING id,title,category,body,created_at,updated_at`;}
 if(!rows.length)return NextResponse.json({error:"Record not found."},{status:404});return NextResponse.json({ok:true,item:rows[0]});
 }catch(e){console.error("Admin update failed",e);return NextResponse.json({error:"Could not update record."},{status:400})}
}
export async function DELETE(req:NextRequest){
 if(!(await guard(req)))return NextResponse.json({error:"Unauthorized"},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const entity=String(b.entity||""),id=Number(b.id);if(!entities.has(entity)||!Number.isInteger(id)||id<1)return NextResponse.json({error:"Invalid request"},{status:400});if(entity==="templates"&&!(await isPrivateVaultUnlocked()))return NextResponse.json({error:"Unlock the private template vault first."},{status:423});
 try{const sql=db();let rows:any[]=[];if(entity==="orders")rows=await sql`DELETE FROM cms_fiverr_orders WHERE id=${id} RETURNING id`;if(entity==="profiles")rows=await sql`DELETE FROM cms_fiverr_profiles WHERE id=${id} RETURNING id`;if(entity==="messages")rows=await sql`DELETE FROM cms_messages WHERE id=${id} RETURNING id`;if(entity==="templates")rows=await sql`DELETE FROM cms_private_templates WHERE id=${id} RETURNING id`;if(!rows.length)return NextResponse.json({error:"Record not found."},{status:404});return NextResponse.json({ok:true,id});}
 catch(e){console.error("Admin delete failed",e);return NextResponse.json({error:"Could not delete record."},{status:500})}
}
