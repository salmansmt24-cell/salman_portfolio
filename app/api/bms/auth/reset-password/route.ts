import {NextRequest,NextResponse} from "next/server";
import {bmsDb,hashBmsPassword,hashBmsToken} from "@/lib/bms-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
function cross(req:NextRequest){const o=req.headers.get("origin"),h=req.headers.get("host");if(!o||!h)return false;try{return new URL(o).host!==h}catch{return true}}
export async function POST(req:NextRequest){
 if(cross(req))return NextResponse.json({error:"Request rejected."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const token=String(b.token??""),password=String(b.password??"");
 if(token.length<30||token.length>200||password.length<12||password.length>128)return NextResponse.json({error:"Use a valid reset link and a password of at least 12 characters."},{status:400});
 try{const sql=bmsDb(),tokenHash=hashBmsToken(token),passwordHash=await hashBmsPassword(password);
 const rows=await sql`WITH claimed AS (
  UPDATE bms_password_reset_tokens SET used_at=NOW()
  WHERE id=(SELECT id FROM bms_password_reset_tokens WHERE token_hash=${tokenHash} AND used_at IS NULL AND expires_at>NOW() LIMIT 1)
  AND used_at IS NULL RETURNING member_id
 ), changed AS (
  UPDATE bms_team_members SET password_hash=${passwordHash},updated_at=NOW()
  WHERE id=(SELECT member_id FROM claimed) AND status='active' RETURNING id,email
 ) SELECT id,email FROM changed`;
 if(!rows.length)return NextResponse.json({error:"This reset link is invalid, expired, already used, or the account is not active. Request a new link or contact your administrator."},{status:400});
 const memberId=Number(rows[0].id);
 await sql`UPDATE bms_password_reset_tokens SET used_at=NOW() WHERE member_id=${memberId} AND used_at IS NULL`;
 await sql`UPDATE bms_user_sessions SET revoked_at=NOW() WHERE member_id=${memberId} AND revoked_at IS NULL`;
 await sql`INSERT INTO bms_activity_log(actor_member_id,action,entity_type,entity_id,summary) VALUES(${memberId},'password_reset','team_member',${String(memberId)},'Team member reset their password')`;
 return NextResponse.json({ok:true,message:"Password updated. Please sign in with your new password."});
 }catch(e){console.error("BMS password reset failed",e);return NextResponse.json({error:"Could not reset password. Please try again."},{status:503});}
}