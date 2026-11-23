import { NextRequest,NextResponse } from "next/server";
import { clearAdminCookie,getAdminSession } from "@/lib/admin-auth";
import { recordSecurityEvent,securitySql } from "@/lib/admin-security";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin"),host=request.headers.get("host");
 if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Request rejected."},{status:403})}catch{return NextResponse.json({error:"Request rejected."},{status:403})}}
 const session=await getAdminSession();
 if(session){try{const sql=securitySql();await sql`UPDATE admin_security_sessions SET revoked_at=NOW() WHERE id=${session.sessionId} AND username=${session.username} AND revoked_at IS NULL`;await recordSecurityEvent(session.username,"logout",request.headers)}catch(e){console.error("Admin logout audit failed:",e)}}
 await clearAdminCookie();
 return NextResponse.redirect(new URL("/admin/login",request.url),303);
}
