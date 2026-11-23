import {NextRequest,NextResponse} from "next/server";
import {getAdminSession} from "@/lib/admin-auth";
import {securitySql,requestIp} from "@/lib/admin-security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 const origin=req.headers.get("origin"),host=req.headers.get("host");if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Request rejected"},{status:403})}catch{return NextResponse.json({error:"Request rejected"},{status:403})}}
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const displayName=String(b.displayName??"").trim().slice(0,120),email=String(b.recoveryEmail??"").trim().toLowerCase();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid recovery email."},{status:400});
 try{const sql=securitySql(),ua=(req.headers.get("user-agent")||"").slice(0,1000);await sql`INSERT INTO admin_security_profiles(username,display_name,recovery_email) VALUES(${session.username},${displayName},${email||null}) ON CONFLICT(username) DO UPDATE SET display_name=EXCLUDED.display_name,recovery_email=EXCLUDED.recovery_email,updated_at=NOW()`;await sql`INSERT INTO admin_security_audit_log(username,action,details_json,ip_address,user_agent) VALUES(${session.username},'profile_updated','{}'::jsonb,${requestIp(req.headers)},${ua})`;return NextResponse.json({ok:true})}catch(e){console.error("Profile update failed:",e);return NextResponse.json({error:"Profile could not be saved. Check recovery email uniqueness."},{status:503})}
}
