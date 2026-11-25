import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { bmsDb, hashBmsToken, newBmsToken, setBmsCookie, verifyBmsPassword, BMS_SESSION_TTL_SECONDS } from "@/lib/bms-auth";
export const runtime="nodejs";
function originRejected(req:NextRequest){const origin=req.headers.get("origin"),host=req.headers.get("host");if(!origin||!host)return false;try{return new URL(origin).host!==host;}catch{return true;}}
export async function POST(req:NextRequest){
 if(originRejected(req))return NextResponse.json({error:"Request rejected."},{status:403});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??"");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||password.length>128)return NextResponse.json({error:"Enter a valid email and password."},{status:400});
 try{
  const sql=bmsDb(),rows=await sql\`SELECT id,password_hash,status FROM bms_team_members WHERE LOWER(email)=\${email} LIMIT 1\`;
  const member=rows[0];
  if(!member?.password_hash||!(await verifyBmsPassword(password,String(member.password_hash))))
   return NextResponse.json({error:"Email or password is incorrect."},{status:401});
  if(member.status!=="active")return NextResponse.json({error:member.status==="pending"?"Your account is waiting for administrator approval.":"This account cannot sign in. Contact your administrator."},{status:403});
  const token=newBmsToken(),expiresAt=new Date(Date.now()+BMS_SESSION_TTL_SECONDS*1000),rawIp=req.headers.get("x-real-ip")||"",ip=isIP(rawIp)?rawIp:null;
  await sql\`INSERT INTO bms_user_sessions(member_id,session_token_hash,user_agent,ip_address,expires_at)
    VALUES(\${member.id},\${hashBmsToken(token)},\${(req.headers.get("user-agent")||"").slice(0,1000)},
    \${ip},\${expiresAt.toISOString()})\`;
  await sql\`UPDATE bms_team_members SET last_login_at=NOW(),updated_at=NOW() WHERE id=\${member.id}\`;
  await setBmsCookie(token);
  return NextResponse.json({ok:true,redirectTo:"/team"});
 }catch(error){console.error("BMS team login failed:",error);return NextResponse.json({error:"Team login is unavailable. Confirm the Preview database migration is applied."},{status:503});}
}
