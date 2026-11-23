import {NextRequest,NextResponse} from "next/server";
import {getAdminSession,verifyAdminPassword} from "@/lib/admin-auth";
import {decryptTotpSecret,encryptTotpSecret,newTotpSecret,recordSecurityEvent,securitySql,verifyTotp} from "@/lib/admin-security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 const origin=req.headers.get("origin"),host=req.headers.get("host");if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Request rejected"},{status:403})}catch{return NextResponse.json({error:"Request rejected"},{status:403})}}
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 try{
  const sql=securitySql(),action=String(b.action||"");
  if(action==="setup"){
   const secret=newTotpSecret(),encrypted=encryptTotpSecret(secret);
   await sql`INSERT INTO admin_security_profiles(username,totp_secret_encrypted,totp_enabled) VALUES(${session.username},${encrypted},FALSE) ON CONFLICT(username) DO UPDATE SET totp_secret_encrypted=EXCLUDED.totp_secret_encrypted,totp_enabled=FALSE,updated_at=NOW()`;
   const issuer="JS Salman Admin",account=encodeURIComponent(session.username),uri=`otpauth://totp/${encodeURIComponent(issuer)}:${account}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
   return NextResponse.json({ok:true,secret,otpauthUri:uri});
  }
  if(action==="enable"){
   const rows=await sql`SELECT totp_secret_encrypted FROM admin_security_profiles WHERE username=${session.username} LIMIT 1`;
   if(!rows[0]?.totp_secret_encrypted)return NextResponse.json({error:"Start two-factor setup first."},{status:400});
   const secret=decryptTotpSecret(String(rows[0].totp_secret_encrypted));
   if(!verifyTotp(secret,String(b.code||"")))return NextResponse.json({error:"Code did not match. Check your authenticator app."},{status:400});
   await sql`UPDATE admin_security_profiles SET totp_enabled=TRUE,updated_at=NOW() WHERE username=${session.username}`;
   await recordSecurityEvent(session.username,"two_factor_enabled",req.headers);
   return NextResponse.json({ok:true});
  }
  if(action==="disable"){
   if(typeof b.currentPassword!=="string"||!(await verifyAdminPassword(session.username,b.currentPassword)))return NextResponse.json({error:"Current password is incorrect."},{status:403});
   const rows=await sql`SELECT totp_secret_encrypted,totp_enabled FROM admin_security_profiles WHERE username=${session.username} LIMIT 1`;
   if(!rows[0]?.totp_enabled)return NextResponse.json({error:"Two-factor authentication is not enabled."},{status:400});
   const secret=decryptTotpSecret(String(rows[0].totp_secret_encrypted||""));
   if(!verifyTotp(secret,String(b.code||"")))return NextResponse.json({error:"Invalid authenticator code."},{status:403});
   await sql`UPDATE admin_security_profiles SET totp_enabled=FALSE,totp_secret_encrypted=NULL,updated_at=NOW() WHERE username=${session.username}`;
   await recordSecurityEvent(session.username,"two_factor_disabled",req.headers);
   return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Unknown action."},{status:400});
 }catch(e){console.error("Two-factor action failed:",e);return NextResponse.json({error:"Two-factor setup unavailable. Confirm ADMIN_TOTP_ENCRYPTION_KEY is configured for Preview."},{status:503})}
}
