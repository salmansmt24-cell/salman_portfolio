import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { bmsDb, hashBmsToken, newBmsToken, setBmsCookie, verifyBmsPassword, BMS_SESSION_TTL_SECONDS } from "@/lib/bms-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function originRejected(req:NextRequest){const origin=req.headers.get("origin"),host=req.headers.get("host");if(!origin||!host)return false;try{return new URL(origin).host!==host;}catch{return true;}}
async function isBlocked(sql:ReturnType<typeof bmsDb>,key:string){const rows=await sql`SELECT 1 FROM bms_auth_rate_limits WHERE key_hash=${key} AND blocked_until>NOW() LIMIT 1`;return rows.length>0;}
async function recordFailure(sql:ReturnType<typeof bmsDb>,key:string,limit:number){await sql`INSERT INTO bms_auth_rate_limits(key_hash,attempts,window_started_at,updated_at) VALUES(${key},1,NOW(),NOW()) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN bms_auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN 1 ELSE bms_auth_rate_limits.attempts+1 END,window_started_at=CASE WHEN bms_auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE bms_auth_rate_limits.window_started_at END,blocked_until=CASE WHEN bms_auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN NULL WHEN bms_auth_rate_limits.attempts+1>=${limit} THEN NOW()+INTERVAL '15 minutes' ELSE bms_auth_rate_limits.blocked_until END,updated_at=NOW()`;}
export async function POST(req:NextRequest){
 if(originRejected(req))return NextResponse.json({error:"Request rejected."},{status:403});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??"");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||password.length>128)return NextResponse.json({error:"Enter a valid email and password."},{status:400});
 try{
  const sql=bmsDb(),rawIp=req.headers.get("x-real-ip")||"",ip=isIP(rawIp)?rawIp:"unknown";
  const emailKey=hashBmsToken("bms-login-email:"+email+":"+ip),ipKey=hashBmsToken("bms-login-ip:"+ip);
  if(await isBlocked(sql,emailKey)||await isBlocked(sql,ipKey))return NextResponse.json({error:"Too many sign-in attempts. Wait 15 minutes and try again."},{status:429,headers:{"Retry-After":"900"}});
  const rows=await sql`SELECT id,password_hash,status FROM bms_team_members WHERE LOWER(email)=${email} LIMIT 1`;
  const member=rows[0];
  if(!member?.password_hash||!(await verifyBmsPassword(password,String(member.password_hash)))){
   await recordFailure(sql,emailKey,8);await recordFailure(sql,ipKey,30);
   return NextResponse.json({error:"Email or password is incorrect."},{status:401});
  }
  if(member.status!=="active")return NextResponse.json({error:member.status==="pending"?"Your account is waiting for administrator approval.":"This account cannot sign in. Contact your administrator."},{status:403});
  const token=newBmsToken(),expiresAt=new Date(Date.now()+BMS_SESSION_TTL_SECONDS*1000);
  await sql`INSERT INTO bms_user_sessions(member_id,session_token_hash,user_agent,ip_address,expires_at) VALUES(${member.id},${hashBmsToken(token)},${(req.headers.get("user-agent")||"").slice(0,1000)},${isIP(rawIp)?rawIp:null},${expiresAt.toISOString()})`;
  await sql`UPDATE bms_team_members SET last_login_at=NOW(),updated_at=NOW() WHERE id=${member.id}`;
  await sql`DELETE FROM bms_auth_rate_limits WHERE key_hash=${emailKey}`;
  await setBmsCookie(token);
  return NextResponse.json({ok:true,redirectTo:"/team"});
 }catch(error){console.error("BMS team login failed:",error);return NextResponse.json({error:"Team login is unavailable. Confirm the Preview database migration is applied."},{status:503});}
}