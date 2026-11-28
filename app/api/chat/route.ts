import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {neon} from "@neondatabase/serverless";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function db(){if(!process.env.DATABASE_URL)throw new Error("Database is not configured");return neon(process.env.DATABASE_URL)}
function ipOf(req:NextRequest){return (req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim().slice(0,100)}
function hashIp(ip:string){return createHash("sha256").update((process.env.ADMIN_SESSION_SECRET||"site-chat-rate-limit")+":"+ip).digest("hex")}
async function rateLimit(sql:any,hash:string,kind:string,limit:number,minutes:number){
  await sql`CREATE TABLE IF NOT EXISTS cms_public_rate_limits(key_hash CHAR(64) NOT NULL,kind VARCHAR(20) NOT NULL,window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),request_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(key_hash,kind))`;
  const interval=minutes+" minutes";
  const rows=await sql`INSERT INTO cms_public_rate_limits(key_hash,kind,window_start,request_count) VALUES(${hash},${kind},NOW(),1)
    ON CONFLICT(key_hash,kind) DO UPDATE SET
      window_start=CASE WHEN cms_public_rate_limits.window_start<NOW()-${interval}::interval THEN NOW() ELSE cms_public_rate_limits.window_start END,
      request_count=CASE WHEN cms_public_rate_limits.window_start<NOW()-${interval}::interval THEN 1 ELSE cms_public_rate_limits.request_count+1 END
    RETURNING request_count`;
  return Number(rows[0]?.request_count||0)<=limit;
}
function freeAnswer(question:string){
  const q=question.toLowerCase();
  const bangla=/[\u0980-\u09FF]/.test(question);
  const has=(...words:string[])=>words.some(w=>q.includes(w));
  if(has("price","pricing","cost","budget","কত টাকা","দাম","প্রাইস","খরচ"))
    return bangla
      ?"প্রজেক্টের মূল্য কাজের ধরন, ফিচার ও সময়সীমার ওপর নির্ভর করে। আপনার প্রয়োজনীয়তা Contact Form-এ পাঠান, Salman বিস্তারিত কোটেশন দেবেন।"
      :"Project pricing depends on the scope, features, and timeline. Please send your requirements through the Contact Form for a tailored quote.";
  if(has("wordpress","ওয়ার্ডপ্রেস","woocommerce","ওয়েবসাইট"))
    return bangla
      ?"WordPress ও WooCommerce ওয়েবসাইট তৈরি, কাস্টমাইজেশন, Elementor, bug fixing, speed optimization এবং website management-এ সহায়তা পাওয়া যায়। নির্দিষ্ট কাজের জন্য Contact Form ব্যবহার করুন।"
      :"Salman can help with WordPress and WooCommerce development, Elementor customization, bug fixes, speed optimization, and ongoing website management. Use the Contact Form to discuss your project.";
  if(has("shopify","শপিফাই"))
    return bangla
      ?"Shopify store setup, theme customization, product/store management এবং troubleshooting-এর জন্য যোগাযোগ করতে পারেন।"
      :"You can enquire about Shopify store setup, theme customization, product/store management, and troubleshooting through the Contact Form.";
  if(has("lead generation","লিড জেনারেশন","লিড","data entry","ডাটা এন্ট্রি"))
    return bangla
      ?"B2B Lead Generation, web research, data entry এবং website management সেবা পাওয়া যায়। আপনার target audience ও কাজের পরিধি জানিয়ে Contact Form পাঠান।"
      :"Services include B2B lead generation, web research, data entry, and website management. Share your target audience and scope through the Contact Form.";
  if(has("experience","years","অভিজ্ঞতা","কত বছর"))
    return bangla
      ?"Salman-এর ৭+ বছরের ওয়েবসাইট ও ডিজিটাল কাজের অভিজ্ঞতা রয়েছে। বিস্তারিত জানতে About ও Experience সেকশন দেখুন।"
      :"Salman has 7+ years of experience across website and digital work. Please see the About and Experience sections for more details.";
  if(has("location","address","where","কোথায়","ঠিকানা"))
    return bangla
      ?"Salman বাংলাদেশে কাজ করেন এবং আন্তর্জাতিক ক্লায়েন্টদের সঙ্গেও রিমোটলি কাজ করতে পারেন।"
      :"Salman is based in Bangladesh and can work remotely with clients worldwide.";
  if(has("contact","email","hire","যোগাযোগ","কাজ দিতে","নিয়োগ"))
    return bangla
      ?"কাজের বিস্তারিত, বাজেট ও সময়সীমা Contact Form-এ পাঠান। আপনার বার্তা ওয়েবসাইটে সংরক্ষিত হবে এবং Salman পরে যোগাযোগ করতে পারবেন।"
      :"To discuss a project, submit your name, email, service, and requirements using the Contact Form. Your message will be securely saved for follow-up.";
  if(has("hello","hi","hey","হ্যালো","আসসালামু"))
    return bangla
      ?"হ্যালো! আমি Salman-এর ওয়েবসাইটের ফ্রি সহকারী। WordPress, Shopify, ওয়েবসাইট ম্যানেজমেন্ট, Lead Generation বা প্রজেক্ট নিয়ে প্রশ্ন করতে পারেন।"
      :"Hello! I'm the free website assistant. Ask me about WordPress, Shopify, website management, lead generation, or how to discuss a project.";
  return bangla
    ?"আমি এই ওয়েবসাইটের সেবা ও যোগাযোগ-সংক্রান্ত সাধারণ প্রশ্নে সাহায্য করতে পারি। WordPress, Shopify, Lead Generation বা প্রজেক্ট কোটেশন সম্পর্কে জিজ্ঞেস করুন।"
    :"I can help with basic questions about this portfolio and its services. Try asking about WordPress, Shopify, lead generation, experience, or project enquiries. For anything else, please use the Contact Form.";
}
export async function POST(req:NextRequest){
  let body:any;try{body=await req.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
  const input=Array.isArray(body.messages)?body.messages.slice(-12):[];
  const last=[...input].reverse().find((m:any)=>m?.role==="user");
  const question=typeof last?.content==="string"?last.content.trim().slice(0,1200):"";
  if(!question)return NextResponse.json({error:"Please enter a question."},{status:400});
  try{
    const sql=db();
    if(!(await rateLimit(sql,hashIp(ipOf(req)),"chat",10,10)))return NextResponse.json({error:"You've sent many questions. Please wait a few minutes and try again."},{status:429});
    if(!(await rateLimit(sql,hashIp("global"),"chat-global",100,1440)))return NextResponse.json({error:"The website chat has reached its daily usage limit. Please use the contact form."},{status:429});
    return NextResponse.json({ok:true,answer:freeAnswer(question),mode:"free-local"});
  }catch(error){console.error("Free chat request failed",error);return NextResponse.json({error:"The assistant is temporarily unavailable. Please use the Contact Form."},{status:503})}
}
