import { NextRequest, NextResponse } from "next/server";
import { getBmsSession, bmsDb } from "@/lib/bms-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const statuses = ["todo","in_progress","review","blocked","completed","cancelled"];
const elevated = (role:string) => role==="Admin" || role==="Team Leader" || role==="Super Admin";

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const member=await getBmsSession();
 if(!member)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {id:raw}=await params, id=Number(raw);
 if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:"Invalid task id."},{status:400});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const status=String(body.status??"");
 if(!statuses.includes(status))return NextResponse.json({error:"Invalid task status."},{status:400});
 try{
  const sql=bmsDb();
  const access=await sql`SELECT assigned_to,created_by_member_id FROM bms_tasks WHERE id=${id} LIMIT 1`;
  if(!access.length)return NextResponse.json({error:"Task not found."},{status:404});
  const own=Number(access[0].assigned_to)===member.memberId||Number(access[0].created_by_member_id)===member.memberId;
  if(!elevated(member.role)&&!own)return NextResponse.json({error:"You cannot update this task."},{status:403});
  const rows=await sql`UPDATE bms_tasks SET status=${status},completed_at=CASE WHEN ${status}='completed' THEN NOW() ELSE NULL END,updated_at=NOW()
   WHERE id=${id} RETURNING id,title,status,priority,assigned_to,completed_at,updated_at`;
  await sql`INSERT INTO bms_activity_log(actor_member_id,action,entity_type,entity_id,summary)
   VALUES(${member.memberId},'task_status_changed','task',${String(id)},${"Changed task status to "+status})`;
  if(Number(access[0].assigned_to)!==member.memberId)
   await sql`INSERT INTO bms_notifications(member_id,notification_type,title,body,target_url)
    VALUES(${Number(access[0].assigned_to)},'task_updated','Task updated',${rows[0].title+" status: "+status},'/team/tasks')`;
  return NextResponse.json({ok:true,task:rows[0]});
 }catch(error){console.error("BMS task update failed:",error);return NextResponse.json({error:"Could not update task."},{status:503});}
}
