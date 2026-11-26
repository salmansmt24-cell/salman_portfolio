import { NextRequest, NextResponse } from "next/server";
import { bmsDb, hashBmsPassword, hashBmsToken } from "@/lib/bms-auth";
export const runtime = "nodejs";
function originRejected(req: NextRequest) {
  const origin=req.headers.get("origin"),host=req.headers.get("host");
  if(!origin||!host)return false;
  try{return new URL(origin).host!==host;}catch{return true;}
}
export async function POST(req:NextRequest) {
  if(originRejected(req))return NextResponse.json({error:"Request rejected."},{status:403});
  let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
  const token=String(body.token??""),password=String(body.password??"");
  if(token.length<30||token.length>200||password.length<12||password.length>128)
    return NextResponse.json({error:"Use a valid invitation and a password of at least 12 characters."},{status:400});
  try{
    const sql=bmsDb(),hash=hashBmsToken(token);
    const rows=await sql`SELECT id FROM bms_team_members WHERE invited_token_hash=${hash}
      AND status='invited' AND invitation_expires_at>NOW() LIMIT 1`;
    if(!rows.length)return NextResponse.json({error:"This invitation is invalid or has expired. Ask your administrator for a new invitation."},{status:400});
    const passwordHash=await hashBmsPassword(password);
    const updated=await sql`UPDATE bms_team_members SET password_hash=${passwordHash},status='pending',
      invited_token_hash=NULL,invitation_expires_at=NULL,updated_at=NOW()
      WHERE id=${rows[0].id} AND status='invited' AND invited_token_hash=${hash}
      RETURNING id,email`;
    if(!updated.length)return NextResponse.json({error:"Invitation has already been used."},{status:409});
    await sql`INSERT INTO bms_activity_log(action,entity_type,entity_id,summary)
      VALUES('invitation_accepted','team_member',${String(updated[0].id)},'Team member set a password; awaiting administrator approval')`;
    return NextResponse.json({ok:true,message:"Password saved. Your account is waiting for administrator approval."});
  }catch(error){console.error("BMS invitation acceptance failed:",error);return NextResponse.json({error:"Could not accept invitation. Contact your administrator."},{status:503});}
}
