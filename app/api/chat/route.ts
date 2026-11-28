import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  return neon(process.env.DATABASE_URL);
}
function ipOf(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 100);
}
function hashIp(ip: string) {
  return createHash("sha256").update((process.env.ADMIN_SESSION_SECRET || "site-chat-rate-limit") + ":" + ip).digest("hex");
}
async function rateLimit(sql: any, hash: string, kind: string, limit: number, minutes: number) {
  await sql`CREATE TABLE IF NOT EXISTS cms_public_rate_limits(key_hash CHAR(64) NOT NULL,kind VARCHAR(20) NOT NULL,window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),request_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(key_hash,kind))`;
  const interval = minutes + " minutes";
  const rows = await sql`INSERT INTO cms_public_rate_limits(key_hash,kind,window_start,request_count) VALUES(${hash},${kind},NOW(),1)
    ON CONFLICT(key_hash,kind) DO UPDATE SET
      window_start=CASE WHEN cms_public_rate_limits.window_start<NOW()-${interval}::interval THEN NOW() ELSE cms_public_rate_limits.window_start END,
      request_count=CASE WHEN cms_public_rate_limits.window_start<NOW()-${interval}::interval THEN 1 ELSE cms_public_rate_limits.request_count+1 END
    RETURNING request_count`;
  return Number(rows[0]?.request_count || 0) <= limit;
}

type Knowledge = { title: string; keywords: string[]; answerEn: string; answerBn: string };
const KNOWLEDGE: Knowledge[] = [
 {title:"WordPress",keywords:["wordpress","wp","ওয়ার্ডপ্রেস","ওয়েবসাইট তৈরি"],answerEn:"WordPress services include website development, redesign, Elementor customization, WooCommerce setup, bug fixing, speed optimization, security updates and ongoing website management. Share your website URL and requirements through the Contact Form for a project-specific quote.",answerBn:"WordPress সেবার মধ্যে website development, redesign, Elementor customization, WooCommerce setup, bug fixing, speed optimization, security update ও website management রয়েছে। আপনার ওয়েবসাইটের URL এবং প্রয়োজন Contact Form-এ পাঠালে কাজ অনুযায়ী quotation দেওয়া যাবে।"},
 {title:"WooCommerce",keywords:["woocommerce","woo commerce","online shop","ecommerce","ইকমার্স","অনলাইন দোকান"],answerEn:"WooCommerce work can include store setup, product and category structure, payment/shipping configuration, checkout fixes, theme customization and maintenance. Final scope and price depend on the features and existing store.",answerBn:"WooCommerce store setup, product/category সাজানো, payment/shipping configuration, checkout fix, theme customization ও maintenance করা যায়। খরচ ও সময় ফিচার এবং বর্তমান store-এর অবস্থার ওপর নির্ভর করে।"},
 {title:"Shopify",keywords:["shopify","শপিফাই"],answerEn:"Shopify support includes store setup, theme customization, product/store management, app configuration and troubleshooting. Send the store URL and a list of required changes through the Contact Form.",answerBn:"Shopify store setup, theme customization, product/store management, app configuration ও troubleshooting-এর জন্য যোগাযোগ করতে পারেন। Store URL ও কী কী পরিবর্তন দরকার তা Contact Form-এ দিন।"},
 {title:"Wix, Squarespace, Kajabi and GHL",keywords:["wix","squarespace","kajabi","gohighlevel","go high level"," ghl"," ghl ","ghl","ওয়িক্স"],answerEn:"Website setup and management enquiries for Wix, Squarespace, Kajabi and GoHighLevel (GHL) can be discussed. Please mention the platform, website URL and exact task so the scope can be reviewed.",answerBn:"Wix, Squarespace, Kajabi ও GoHighLevel (GHL) website setup/management নিয়ে আলোচনা করা যায়। Platform, website URL এবং নির্দিষ্ট কাজটি Contact Form-এ উল্লেখ করুন।"},
 {title:"B2B Lead Generation",keywords:["lead generation","b2b leads","prospect list","লিড জেনারেশন","লিড খোঁজা"],answerEn:"B2B lead generation and web research services can help build targeted prospect lists. Please specify industry, target countries, decision-maker roles, required fields and whether verified business emails are needed.",answerBn:"B2B lead generation ও web research-এর মাধ্যমে target prospect list তৈরি করা যায়। Industry, target country, decision-maker role, প্রয়োজনীয় data fields এবং verified business email লাগবে কি না জানালে কাজের scope বোঝা যাবে।"},
 {title:"Data Entry and Web Research",keywords:["data entry","web research","data collection","ডাটা এন্ট্রি","তথ্য সংগ্রহ"],answerEn:"Data entry, web research, spreadsheet cleanup, data collection and website data management are available project enquiries. Share the sample, volume, source and output format to receive an accurate estimate.",answerBn:"Data entry, web research, spreadsheet cleanup, data collection ও website data management-এর কাজ নেওয়া যায়। Sample, data volume, source এবং output format দিলে সঠিক estimate দেওয়া সম্ভব।"},
 {title:"Website Management",keywords:["website management","website manager","maintenance","site update","ওয়েবসাইট ম্যানেজ"],answerEn:"Website management may include content updates, product uploads, plugin/theme updates, backups, routine checks and small fixes. Monthly support availability and scope should be confirmed for each project.",answerBn:"Website management-এ content update, product upload, plugin/theme update, backup, routine check ও ছোটখাটো fix থাকতে পারে। Monthly support-এর scope ও availability project অনুযায়ী নিশ্চিত করতে হবে।"},
 {title:"Pricing and Quote",keywords:["price","pricing","cost","budget","quote","quotation","how much","rate","দাম","কত টাকা","খরচ","বাজেট","কোটেশন"],answerEn:"There is no single fixed price for every project. Pricing depends on the platform, page count, features, integrations, content readiness and deadline. Send the scope, budget and preferred delivery date through the Contact Form for a tailored quote.",answerBn:"সব project-এর জন্য এক দাম নয়। Platform, page সংখ্যা, feature, integration, content প্রস্তুত কি না এবং deadline অনুযায়ী মূল্য নির্ধারণ হয়। Scope, budget ও delivery date Contact Form-এ পাঠালে নির্দিষ্ট quotation দেওয়া যাবে।"},
 {title:"Delivery and Process",keywords:["delivery","timeline","how long","deadline","process","কত দিন","সময় লাগবে","কাজের ধাপ"],answerEn:"A typical process is: review requirements, confirm scope and quote, agree on milestones, build on the agreed platform, review changes, then hand over. Delivery time is confirmed after the scope is clear.",answerBn:"সাধারণ workflow: requirement review → scope ও quotation confirm → milestone ঠিক করা → website তৈরি → review/revision → handover। Scope পরিষ্কার হওয়ার পর delivery time নিশ্চিত করা হয়।"},
 {title:"Revisions and Support",keywords:["revision","revisions","support","after delivery","warranty","সাপোর্ট","রিভিশন"],answerEn:"Revision and post-delivery support depend on the agreed project scope and offer. Please confirm the included revision count, support period and any ongoing maintenance before starting.",answerBn:"Revision ও delivery-পরবর্তী support project-এর agreed scope অনুযায়ী হয়। কাজ শুরুর আগে revision সংখ্যা, support period এবং ongoing maintenance অন্তর্ভুক্ত কি না নিশ্চিত করুন।"},
 {title:"Experience",keywords:["experience","years","background","skills","অভিজ্ঞতা","কত বছর"],answerEn:"The portfolio presents Salman as a web and digital services professional with 7+ years of experience across website work and online business support. Please check the Experience and Portfolio sections for project details.",answerBn:"Portfolio অনুযায়ী Salman-এর website ও digital services-এ ৭+ বছরের অভিজ্ঞতা রয়েছে। নির্দিষ্ট কাজের উদাহরণ দেখতে Experience ও Portfolio section দেখুন।"},
 {title:"Location and Remote Work",keywords:["location","address","where are you","country","remote","বাংলাদেশ","কোথায় থাকেন","ঠিকানা"],answerEn:"Salman is based in Bangladesh and can discuss remote projects with clients internationally. Project communication and schedule can be agreed before starting.",answerBn:"Salman বাংলাদেশে অবস্থান করেন এবং আন্তর্জাতিক client-এর সঙ্গে remote project করতে পারেন। কাজ শুরুর আগে communication ও schedule ঠিক করা যায়।"},
 {title:"Contact and Hiring",keywords:["contact","email","hire","work with you","message","যোগাযোগ","কাজ দিতে চাই","নিয়োগ"],answerEn:"To enquire or hire, use the Contact Form on this portfolio. Include your name, email, platform, project requirements, budget and desired deadline. The message is saved for follow-up; this form does not promise instant email delivery.",answerBn:"কাজের জন্য portfolio-এর Contact Form ব্যবহার করুন। নাম, email, platform, project requirement, budget ও deadline দিন। Message follow-up-এর জন্য website database-এ save হয়; instant email পাঠানো হবে এমন নিশ্চয়তা নেই।"},
 {title:"Portfolio and Projects",keywords:["portfolio","projects","work samples","case study","কাজের নমুনা","প্রজেক্ট"],answerEn:"You can browse the Portfolio section for work samples and project types. If you have a reference website, share its URL and explain which parts you want to achieve.",answerBn:"কাজের নমুনা ও project type দেখতে Portfolio section দেখুন। আপনার reference website থাকলে URL পাঠিয়ে কোন অংশটি পছন্দ তা উল্লেখ করুন।"},
 {title:"Languages",keywords:["language","bangla","bengali","english","বাংলা","ভাষা"],answerEn:"You can send your project enquiry in Bangla or English. The portfolio assistant recognizes common questions in both languages, but it is a limited website FAQ helper rather than a fully general AI model.",answerBn:"বাংলা বা English—দুই ভাষাতেই project enquiry পাঠাতে পারেন। Website assistant দুই ভাষার সাধারণ FAQ বুঝতে পারে, তবে এটি সীমিত FAQ helper; unrestricted AI নয়।"},
 {title:"Greeting",keywords:["hello","hi","hey","good morning","assalamu alaikum","হ্যালো","আসসালামু আলাইকুম"],answerEn:"Hello! I'm the free portfolio assistant. I can help with Salman’s website services, project process, portfolio and contact details.",answerBn:"হ্যালো! আমি portfolio-এর free assistant। Salman-এর website services, project process, portfolio ও যোগাযোগ বিষয়ে সাহায্য করতে পারি।"},
 {title:"Admin Login",keywords:["admin login","admin panel","login option","লগইন","এডমিন"],answerEn:"The administrator sign-in page is available at /admin/login. This is a private dashboard; only the site administrator should sign in.",answerBn:"Administrator login page /admin/login ঠিকানায়। এটি private dashboard—শুধু site administrator sign in করবেন।"}
];

const STOP = new Set(["the","a","an","and","or","for","to","of","is","are","can","you","i","my","your","please","what","how","do","does","with","in","on","about","me","tell","আমার","আপনি","কি","কী","কেমন","হবে","করতে","এর","একটি","দিয়ে","জন্য"]);
function words(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(w=>w.length>1&&!STOP.has(w));
}
function scoreText(question: string, doc: string, keywords: string[] = []) {
  const q=question.toLowerCase(), d=doc.toLowerCase();
  let score=0;
  for(const key of keywords) if(key.trim() && q.includes(key.toLowerCase().trim())) score+=4+Math.min(3,key.trim().split(/\s+/).length);
  const qWords=new Set(words(question)), dWords=new Set(words(doc));
  let overlap=0; for(const w of qWords) if(dWords.has(w)) overlap++;
  score+=overlap*1.5;
  if(qWords.size) score+=overlap/qWords.size*3;
  return score;
}
function fallback(question: string) {
  const bangla=/[\u0980-\u09FF]/.test(question);
  return bangla
    ?"আমি Salman-এর portfolio ও website services বিষয়ে সাহায্য করতে পারি, কিন্তু এই free setup-এ unrestricted general AI নেই—তাই সব ধরনের প্রশ্নের সঠিক উত্তর দেওয়ার দাবি করছি না। WordPress, Shopify, website management, lead generation, pricing বা project process সম্পর্কে জিজ্ঞেস করুন; অন্য বিষয়ে Contact Form-এ message পাঠাতে পারেন।"
    :"I’m a free portfolio assistant, not an unrestricted general AI, so I can’t guarantee accurate answers to every possible question. I can help with Salman’s services, portfolio, pricing process, website platforms and project enquiries. For an unrelated or uncertain question, please use the Contact Form rather than relying on a guess.";
}
async function answerQuestion(sql: any, question: string, context: string) {
  const query=(question+" "+context).slice(-1800);
  const bangla=/[\u0980-\u09FF]/.test(question);
  const ranked=KNOWLEDGE.map(item=>({item,score:scoreText(query,item.title+" "+item.keywords.join(" "),item.keywords)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  if(best && best.score>=4) return bangla?best.item.answerBn:best.item.answerEn;

  try {
    const [contentRows, itemRows]=await Promise.all([
      sql`SELECT content_key,content_value FROM cms_content LIMIT 600`,
      sql`SELECT module,title,description,subtitle FROM cms_items WHERE is_published=TRUE ORDER BY sort_order,id LIMIT 180`
    ]);
    const docs:Array<{title:string;body:string;module?:string}>=[];
    for(const row of contentRows) if(row.content_value) docs.push({title:String(row.content_key||"Portfolio content"),body:String(row.content_value)});
    for(const row of itemRows) docs.push({title:String(row.title||row.module||"Portfolio item"),body:[row.subtitle,row.description].filter(Boolean).join(". "),module:String(row.module||"")});
    if(/service|সেবা|কী কী কাজ|what do you do/i.test(question)){
      const services=docs.filter(d=>d.module==="services"&&d.title&&d.body).slice(0,12);
      if(services.length) return (bangla?"Portfolio-এ উল্লেখিত service গুলো:\n":"Services listed in the portfolio:\n")+services.map(d=>"• "+d.title+": "+d.body.slice(0,280)).join("\n");
    }
    const matches=docs.map(d=>({d,score:scoreText(query,d.title+" "+d.body)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
    if(matches.length&&matches[0].score>=5){
      const top=matches[0].d;
      const snippet=top.body.replace(/\s+/g," ").slice(0,650);
      return (bangla?"Portfolio content অনুযায়ী":"According to the portfolio content")+": "+top.title+" — "+snippet;
    }
  } catch(error) { console.error("Chat knowledge retrieval failed",error); }
  return fallback(question);
}

export async function POST(req: NextRequest) {
  let body:any; try { body=await req.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  const messages=Array.isArray(body.messages)?body.messages.slice(-12):[];
  const last=[...messages].reverse().find((m:any)=>m?.role==="user");
  const question=typeof last?.content==="string"?last.content.trim().slice(0,1200):"";
  if(!question) return NextResponse.json({error:"Please enter a question."},{status:400});
  const context=messages.filter((m:any)=>m?.role==="user"&&typeof m.content==="string").slice(-5,-1).map((m:any)=>m.content.slice(0,350)).join(" ");
  try {
    const sql=db();
    if(!(await rateLimit(sql,hashIp(ipOf(req)),"chat",10,10))) return NextResponse.json({error:"You've sent many questions. Please wait a few minutes and try again."},{status:429});
    if(!(await rateLimit(sql,hashIp("global"),"chat-global",100,1440))) return NextResponse.json({error:"The website chat has reached its daily usage limit. Please use the contact form."},{status:429});
    const answer=await answerQuestion(sql,question,context);
    return NextResponse.json({ok:true,answer,mode:"free-portfolio-knowledge"});
  } catch(error) {
    console.error("Free chat request failed",error);
    return NextResponse.json({error:"The assistant is temporarily unavailable. Please use the Contact Form."},{status:503});
  }
}
