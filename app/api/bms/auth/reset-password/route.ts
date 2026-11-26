import {NextRequest,NextResponse} from "next/server";
import {bmsDb,hashBmsPassword,hashBmsToken} from "@/lib/bms-auth";
export const runtime="nodejs";
function cross(req:NextRequest){const o=req.headers.get("origin"),h=req.headers.get("host");if(!o||!h)return false;try{return new URL(o).host!==h}catch{return true}}
export async function POST(req:NextRequest){
 if(cross(req))return NextResponse.json({error:"Request rejected."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 const token=String(b.token??""),password=String(b.password??"");
 if(token.length<30||token.length>200||password.length<12||password.length>128)return NextResponse.json({error:"Use a valid reset link and a password of at least 12 characters."},{status:400});
 try{const sql=bmsDb(),hash=hashBmsToken(token);
 const rows=await sql`SELECT id,member_id FROM bms_password_reset_tokens WHERE token_hash=${hash} AND used_at IS NULL AND expires_at>NOW() LIMIT 1`;
 if(!rows.length)return NextResponse.json({error:"This reset link is invalid, expired or already used. Request a new one."},{status:400});
 const passwordHash=await hashBmsPassword(password);
 const changed=await sql`UPDATE bms_team_members SET password_hash=${passwordHash},updated_at=NOW() WHERE id=${rows[0].member_id} AND status='active' RETURNING id,email`;
 if(!changed.length)return NextResponse.json({error:"This account is not active. Contact your administrator."},{status:403});
 await sql`UPDATE bms_password_reset_tokens SET used_at=NOW() WHERE member_id=${rows[0].member_id} AND used_at IS NULL`;
 await sql`UPDATE bms_user_sessions SET revoked_at=NOW() WHERE member_id=${rows[0].member_id} AND revoked_at IS NULL`;
 await sql`INSERT INTO bms_activity_log(actor_member_id,action,entity_type,entity_id,summary) VALUES(${Number(rows[0].member_id)},'password_reset','team_member',${String(rows[0].member_id)},'Team member reset their password')`;
 return NextResponse.json({ok:true,message:"Password updated. Please sign in with your new password."});
 }catch(e){console.error("BMS password reset failed",e);return NextResponse.json({error:"Could not reset password. Please try again."},{status:503});}
}