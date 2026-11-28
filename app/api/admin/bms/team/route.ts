import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { neon } from "@neondatabase/serverless";
import { newBmsToken, hashBmsToken } from "@/lib/bms-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROLES = ["Admin", "Team Leader", "Sales Executive", "Viewer"] as const;
type Role = typeof ROLES[number];
function rejectCrossOrigin(req: NextRequest) {
  const origin=req.headers.get("origin"),host=req.headers.get("host");
  if(!origin||!host)return false;
  try{return new URL(origin).host!==host;}catch{return true;}
}
function db(){if(!process.env.DATABASE_URL)throw new Error("Database is not configured.");return neon(process.env.DATABASE_URL);}
export async function GET(){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const rows=await db()`SELECT id,full_name,email,role,status,created_at,approved_at,last_login_at FROM bms_team_members ORDER BY created_at DESC,id DESC LIMIT 250`;return NextResponse.json({members:rows});}
 catch(error){console.error("BMS team list failed:",error);return NextResponse.json({error:"Team data is unavailable. Confirm migration 002 has been applied to the Preview database."},{status:503});}
}
export async function POST(req:NextRequest){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(rejectCrossOrigin(req))return NextResponse.json({error:"Request rejected"},{status:403});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const fullName=String(body.fullName??"").trim().slice(0,160),email=String(body.email??"").trim().toLowerCase().slice(0,255),role=String(body.role??"Viewer") as Role;
 if(fullName.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!ROLES.includes(role))return NextResponse.json({error:"Enter a valid name, email and role."},{status:400});
 try{const sql=db(),token=newBmsToken(),tokenHash=hashBmsToken(token),expiresAt=new Date(Date.now()+7*24*60*60*1000);
 const rows=await sql`INSERT INTO bms_team_members(full_name,email,role,status,invited_token_hash,invitation_expires_at,created_by_username)
 VALUES(${fullName},${email},${role},'invited',${tokenHash},${expiresAt.toISOString()},${session.username})
 ON CONFLICT DO NOTHING RETURNING id,full_name,email,role,status,created_at`;
 if(!rows.length)return NextResponse.json({error:"This email may already be registered."},{status:409});
 const member=rows[0];await sql`INSERT INTO bms_activity_log(actor_legacy_username,action,entity_type,entity_id,summary) VALUES(${session.username},'team_member_invited','team_member',${String(member.id)},${"Created invitation for "+email})`;
 const invitationUrl=new URL("/team/accept",req.nextUrl.origin);invitationUrl.searchParams.set("token",token);
 return NextResponse.json({ok:true,member,invitationUrl:invitationUrl.toString(),expiresAt:expiresAt.toISOString()},{status:201});}
 catch(error){console.error("BMS team create failed:",error);return NextResponse.json({error:"Could not create team member. Confirm migration 002 is applied."},{status:503});}
}
export async function PATCH(req:NextRequest){
 const session=await getAdminSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(rejectCrossOrigin(req))return NextResponse.json({error:"Request rejected"},{status:403});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const id=Number(body.id),action=String(body.action??"");if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:"Invalid member id."},{status:400});
 const sql=db();
 try{let rows:any[]=[];
 if(action==="approve")rows=await sql`UPDATE bms_team_members SET status='active',approved_at=NOW(),updated_at=NOW() WHERE id=${id} AND status='pending' RETURNING id,email,status,role`;
 else if(action==="reject")rows=await sql`UPDATE bms_team_members SET status='rejected',invited_token_hash=NULL,updated_at=NOW() WHERE id=${id} AND status IN ('pending','invited') RETURNING id,email,status,role`;
 else if(action==="suspend")rows=await sql`UPDATE bms_team_members SET status='suspended',updated_at=NOW() WHERE id=${id} AND status='active' RETURNING id,email,status,role`;
 else if(action==="reactivate")rows=await sql`UPDATE bms_team_members SET status='active',updated_at=NOW() WHERE id=${id} AND status='suspended' RETURNING id,email,status,role`;
 else if(action==="role"){const role=String(body.role??"") as Role;if(!ROLES.includes(role))return NextResponse.json({error:"Invalid role."},{status:400});rows=await sql`UPDATE bms_team_members SET role=${role},updated_at=NOW() WHERE id=${id} AND status<>'rejected' RETURNING id,email,status,role`;}
 else if(action==="reset_password"){const member=await sql`SELECT id,email,status FROM bms_team_members WHERE id=${id} AND status='active' LIMIT 1`;if(!member.length)return NextResponse.json({error:"Member not found or account cannot reset password."},{status:404});const token=newBmsToken(),expires=new Date(Date.now()+30*60*1000);await sql`UPDATE bms_password_reset_tokens SET used_at=NOW() WHERE member_id=${id} AND used_at IS NULL`;await sql`INSERT INTO bms_password_reset_tokens(member_id,token_hash,expires_at) VALUES(${id},${hashBmsToken(token)},${expires.toISOString()})`;await sql`UPDATE bms_user_sessions SET revoked_at=NOW() WHERE member_id=${id} AND revoked_at IS NULL`;await sql`INSERT INTO bms_activity_log(actor_legacy_username,action,entity_type,entity_id,summary) VALUES(${session.username},'admin_password_reset_link_created','team_member',${String(id)},${"Admin created password reset link for "+member[0].email})`;const resetUrl=new URL("/team/reset-password",req.nextUrl.origin);resetUrl.searchParams.set("token",token);return NextResponse.json({ok:true,resetUrl:resetUrl.toString(),expiresAt:expires.toISOString()});}
 else return NextResponse.json({error:"Unsupported action."},{status:400});
 if(!rows.length)return NextResponse.json({error:"Member not found or status does not allow this action."},{status:404});
 await sql`INSERT INTO bms_activity_log(actor_legacy_username,action,entity_type,entity_id,summary) VALUES(${session.username},${"team_member_"+action},'team_member',${String(id)},${"Updated "+rows[0].email+" ("+action+")"})`;
 return NextResponse.json({ok:true,member:rows[0]});}
 catch(error){console.error("BMS team update failed:",error);return NextResponse.json({error:"Could not update team member. Confirm migration 002 is applied."},{status:503});}
}
