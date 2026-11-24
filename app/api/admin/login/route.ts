import { NextRequest, NextResponse } from "next/server";
import { createSession, registerAdminSession, setAdminCookie, verifyAdminPassword } from "@/lib/admin-auth";
import { decryptTotpSecret, recordSecurityEvent, securitySql, verifyTotp, requestIp } from "@/lib/admin-security";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin=request.headers.get("origin"), host=request.headers.get("host");
  if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Request rejected."},{status:403})}catch{return NextResponse.json({error:"Request rejected."},{status:403})}}
  let body:{username?:string;password?:string;totp?:string};
  try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
  const username=String(body.username??"").trim().slice(0,100), password=String(body.password??""), totp=String(body.totp??"").trim();
  if(!username||!password||password.length>1024)return NextResponse.json({error:"Username and password are required."},{status:400});
  try{
    const sql=securitySql(), ip=requestIp(request.headers);
    const lock=await sql`SELECT COUNT(*)::int AS attempts FROM admin_security_login_events
      WHERE event_type='login_failed' AND created_at>NOW()-INTERVAL '15 minutes'
      AND ip_address IS NOT DISTINCT FROM ${ip}::inet`;
    if(Number(lock[0]?.attempts??0)>=5)return NextResponse.json({error:"Too many failed attempts. Try again in 15 minutes."},{status:429});
    const valid=await verifyAdminPassword(username,password);
    if(!valid){await recordSecurityEvent(username,"login_failed",request.headers,{reason:"invalid_credentials"});return NextResponse.json({error:"Invalid username or password."},{status:401})}
    const profiles=await sql`SELECT totp_enabled,totp_secret_encrypted FROM admin_security_profiles WHERE username=${username} LIMIT 1`;
    if(profiles[0]?.totp_enabled){
      if(!totp)return NextResponse.json({error:"Enter your authenticator code.",requiresTwoFactor:true},{status:401});
      let secret="";try{secret=decryptTotpSecret(String(profiles[0].totp_secret_encrypted??""))}catch{return NextResponse.json({error:"Two-factor verification is not configured correctly. Contact the administrator."},{status:503})}
      if(!verifyTotp(secret,totp)){await recordSecurityEvent(username,"login_failed",request.headers,{reason:"invalid_two_factor"});return NextResponse.json({error:"Invalid authenticator code.",requiresTwoFactor:true},{status:401})}
    }
    const token=createSession(username);
    await registerAdminSession(username,token,request.headers);
    await recordSecurityEvent(username,"login_success",request.headers,{twoFactor:!!profiles[0]?.totp_enabled});
    await setAdminCookie(token);
    return NextResponse.json({ok:true,redirectTo:"/admin"});
  }catch(error){console.error("Admin login failed:",error);return NextResponse.json({error:"Admin login is temporarily unavailable. Check Preview database and environment configuration."},{status:503})}
}
