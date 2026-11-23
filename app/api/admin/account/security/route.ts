import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
import {getAdminSession,ADMIN_COOKIE_NAME} from "@/lib/admin-auth";
import {securitySql,tokenHash} from "@/lib/admin-security";
export const runtime="nodejs";
export async function GET(){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const sql=securitySql(),jar=await cookies(),token=jar.get(ADMIN_COOKIE_NAME)?.value||"";
  const [profile,sessions,events,counts]=await Promise.all([
   sql`SELECT display_name,recovery_email,totp_enabled FROM admin_security_profiles WHERE username=${session.username} LIMIT 1`,
   sql`SELECT id,device_label,ip_address::text AS ip_address,created_at,last_seen_at,expires_at,session_token_hash
       FROM admin_security_sessions WHERE username=${session.username} AND revoked_at IS NULL AND expires_at>NOW()
       ORDER BY last_seen_at DESC LIMIT 30`,
   sql`SELECT event_type,user_agent,ip_address::text AS ip_address,created_at,details_json
       FROM admin_security_login_events WHERE username=${session.username} ORDER BY created_at DESC LIMIT 15`,
   sql`SELECT COUNT(*)::int AS total FROM admin_security_sessions WHERE username=${session.username} AND revoked_at IS NULL AND expires_at>NOW()`
  ]);
  return NextResponse.json({profile:profile[0]||{display_name:"",recovery_email:"",totp_enabled:false},sessions:sessions.map(s=>({...s,is_current:s.session_token_hash===tokenHash(token),session_token_hash:undefined})),events,activeSessions:Number(counts[0]?.total||0)});
 }catch(e){console.error("Security overview read failed:",e);return NextResponse.json({error:"Security data is unavailable. Confirm migration 003 ran on the Preview database."},{status:503})}
}
