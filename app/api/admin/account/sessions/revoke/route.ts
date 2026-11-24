import {NextRequest,NextResponse} from "next/server";
import {getAdminSession} from "@/lib/admin-auth";
import {recordSecurityEvent,securitySql} from "@/lib/admin-security";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 const origin=req.headers.get("origin"),host=req.headers.get("host");if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Request rejected"},{status:403})}catch{return NextResponse.json({error:"Request rejected"},{status:403})}}
 try{const sql=securitySql();const result=await sql`UPDATE admin_security_sessions SET revoked_at=NOW() WHERE username=${session.username} AND id<>${session.sessionId} AND revoked_at IS NULL AND expires_at>NOW() RETURNING id`;await recordSecurityEvent(session.username,"session_revoked",req.headers,{scope:"other_sessions",count:result.length});return NextResponse.json({ok:true,revoked:result.length})}catch(e){console.error("Session revoke failed:",e);return NextResponse.json({error:"Could not revoke other sessions."},{status:503})}
}
