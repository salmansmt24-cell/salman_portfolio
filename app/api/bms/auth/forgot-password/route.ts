import {NextRequest,NextResponse} from "next/server";
import {bmsDb,newBmsToken,hashBmsToken} from "@/lib/bms-auth";
import {isIP} from "node:net";
export const runtime="nodejs";export const dynamic="force-dynamic";
function cross(req:NextRequest){const o=req.headers.get("origin"),h=req.headers.get("host");if(!o||!h)return false;try{return new URL(o).host!==h}catch{return true}}
export async function POST(req:NextRequest){
 if(cross(req))return NextResponse.json({error:"Request rejected."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const email=String(b.email??"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
 const apiKey=process.env.RESEND_API_KEY,from=process.env.BMS_FROM_EMAIL||process.env.CONTACT_FROM_EMAIL;
 if(!apiKey||!from)return NextResponse.json({error:"Password recovery email is not configured yet. Please contact your administrator."},{status:503});
 try{
  const sql=bmsDb(),ipRaw=req.headers.get("x-real-ip")||"",ip=isIP(ipRaw)?ipRaw:null;
  const recent=await sql`SELECT COUNT(*)::int AS count FROM bms_password_reset_tokens WHERE requested_ip IS NOT DISTINCT FROM ${ip} AND created_at>NOW()-INTERVAL '15 minutes'`;
  if(Number(recent[0]?.count||0)>=5)return NextResponse.json({error:"Too many requests. Please try again later."},{status:429});
  const members=await sql`SELECT id,full_name,email FROM bms_team_members WHERE LOWER(email)=${email} AND status='active' LIMIT 1`;
  if(members.length){
   const token=newBmsToken(),expires=new Date(Date.now()+30*60*1000);
   await sql`UPDATE bms_password_reset_tokens SET used_at=NOW() WHERE member_id=${members[0].id} AND used_at IS NULL`;
   await sql`INSERT INTO bms_password_reset_tokens(member_id,token_hash,expires_at,requested_ip) VALUES(${members[0].id},${hashBmsToken(token)},${expires.toISOString()},${ip})`;
   const link=new URL("/team/reset-password",req.nextUrl.origin);link.searchParams.set("token",token);
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[members[0].email],subject:"Reset your team account password",html:`<p>Hello ${String(members[0].full_name).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!))},</p><p>Use the secure link below to reset your BMS password. It expires in 30 minutes and can only be used once.</p><p><a href="${link.toString()}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`}),signal:AbortSignal.timeout(15000)});
   if(!response.ok){const detail=await response.text();console.error("BMS password reset email failed",response.status,detail);return NextResponse.json({error:"Could not send the recovery email. Please contact your administrator."},{status:502});}
  }
  return NextResponse.json({ok:true,message:"If an active account exists for that email, a password reset link has been sent."});
 }catch(e){console.error("BMS forgot password failed",e);return NextResponse.json({error:"Password recovery is temporarily unavailable."},{status:503});}
}