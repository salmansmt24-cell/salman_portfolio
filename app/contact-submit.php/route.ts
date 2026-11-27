import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {neon} from "@neondatabase/serverless";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function db(){if(!process.env.LEGACY_DATABASE_URL)throw new Error("Legacy CMS database is not configured");return neon(process.env.LEGACY_DATABASE_URL)}
function ipOf(req:NextRequest){return (req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim().slice(0,100)}
function hashIp(ip:string){return createHash("sha256").update((process.env.ADMIN_SESSION_SECRET||"site-contact-rate-limit")+":"+ip).digest("hex")}
function safeText(v:unknown,max:number){return typeof v==="string"?v.trim().slice(0,max):""}
function response(req:NextRequest,ok:boolean,message:string,status=200){
  if(req.headers.get("accept")?.includes("application/json")||req.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ok,message},{status});
  const url=new URL("/",req.url);url.searchParams.set("contact",ok?"sent":"error");url.hash="contact";
  return NextResponse.redirect(url,303);
}
async function ensureRateTable(sql:any){
  await sql`CREATE TABLE IF NOT EXISTS cms_public_rate_limits(
    key_hash CHAR(64) NOT NULL,kind VARCHAR(20) NOT NULL,window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(key_hash,kind))`;
}
async function checkRate(sql:any,kind:string,hash:string,limit:number,minutes:number){
  const interval=minutes+" minutes";
  const rows=await sql`INSERT INTO cms_public_rate_limits(key_hash,kind,window_start,request_count)
    VALUES(${hash},${kind},NOW(),1)
    ON CONFLICT(key_hash,kind) DO UPDATE SET
      window_start=CASE WHEN cms_public_rate_limits.window_start<NOW()-${interval}::interval THEN NOW() ELSE cms_public_rate_limits.window_start END,
      request_count=CASE WHEN cms_public_rate_limits.window_start<NOW()-${interval}::interval THEN 1 ELSE cms_public_rate_limits.request_count+1 END
    RETURNING request_count`;
  return Number(rows[0]?.request_count||0)<=limit;
}
export async function POST(req:NextRequest){
  let data:any;
  try{
    if(req.headers.get("content-type")?.includes("application/json"))data=await req.json();
    else {const f=await req.formData();data=Object.fromEntries(f.entries())}
  }catch{return response(req,false,"Please check the form and try again.",400)}
  // Quietly accept honeypot submissions without saving or notifying.
  if(safeText(data.website,300))return response(req,true,"Thanks! Your message has been received.");
  const name=safeText(data.name,120),email=safeText(data.email,255).toLowerCase(),service=safeText(data.service,120),message=safeText(data.message,12000);
  if(!name||!service||message.length<5||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return response(req,false,"Please enter your name, a valid email, service and message.",400);
  try{
    const sql=db();await ensureRateTable(sql);
    const ipHash=hashIp(ipOf(req));
    if(!(await checkRate(sql,"contact",ipHash,5,15)))return response(req,false,"Too many messages from this network. Please try again later.",429);
    const rows=await sql`INSERT INTO cms_messages(name,email,service,message,is_read) VALUES(${name},${email},${service},${message},FALSE) RETURNING id`;
    // Optional email notification. The database inbox remains the source of truth.
    if(process.env.RESEND_API_KEY&&process.env.CONTACT_FROM_EMAIL&&process.env.CONTACT_TO_EMAIL){
      try{
        await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({
          from:process.env.CONTACT_FROM_EMAIL,to:[process.env.CONTACT_TO_EMAIL],reply_to:email,
          subject:"New website enquiry: "+service,
          text:"Name: "+name+"\nEmail: "+email+"\nService: "+service+"\n\n"+message
        })});
      }catch(e){console.error("Contact notification email failed",e)}
    }
    return response(req,true,"Thanks! Your message has been received.");
  }catch(e){console.error("Contact form submit failed",e);return response(req,false,"The message could not be saved. Please email directly.",500)}
}
