import { NextResponse } from "next/server";
import { getBmsSession, bmsDb } from "@/lib/bms-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const member=await getBmsSession();
 if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!["Admin","Super Admin","Team Leader"].includes(member.role))
  return NextResponse.json({members:[{id:member.memberId,full_name:member.fullName}]});
 try{
  const rows=await bmsDb()\`SELECT id,full_name FROM bms_team_members WHERE status='active' ORDER BY full_name LIMIT 200\`;
  return NextResponse.json({members:rows});
 }catch(error){console.error("BMS team options failed:",error);return NextResponse.json({error:"Could not load team options."},{status:503});}
}
