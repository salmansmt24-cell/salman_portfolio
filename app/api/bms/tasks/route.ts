import { NextRequest, NextResponse } from "next/server";
import { getBmsSession, bmsDb } from "@/lib/bms-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const elevated = (role: string) => role === "Admin" || role === "Team Leader" || role === "Super Admin";
const statuses = ["todo", "in_progress", "review", "blocked", "completed", "cancelled"];
const priorities = ["low", "normal", "high", "urgent"];

export async function GET() {
  const member = await getBmsSession();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = bmsDb();
    const all = elevated(member.role);
    const rows = await sql`SELECT t.id,t.title,t.description,t.status,t.priority,t.assigned_to,
      t.created_by_member_id,t.due_at,t.completed_at,t.created_at,t.updated_at,
      a.full_name AS assignee_name,c.full_name AS creator_name
      FROM bms_tasks t
      LEFT JOIN bms_team_members a ON a.id=t.assigned_to
      LEFT JOIN bms_team_members c ON c.id=t.created_by_member_id
      WHERE (${all} OR t.assigned_to=${member.memberId} OR t.created_by_member_id=${member.memberId}
      OR t.created_by_legacy_username=${member.email})
      ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END,
      t.due_at NULLS LAST,t.created_at DESC LIMIT 300`;
    return NextResponse.json({ tasks: rows });
  } catch (error) {
    console.error("BMS task list failed:", error);
    return NextResponse.json({ error: "Tasks are unavailable. Check the Preview database migration." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const member = await getBmsSession();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const title = String(body.title ?? "").trim().slice(0, 240);
  const description = String(body.description ?? "").trim().slice(0, 8000);
  const priority = String(body.priority ?? "normal");
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (title.length < 3 || !priorities.includes(priority) || (dueAt && Number.isNaN(dueAt.getTime()))) {
    return NextResponse.json({ error: "Enter a task title and valid priority/date." }, { status: 400 });
  }
  const canAssign = elevated(member.role);
  const assignedTo = canAssign && body.assignedTo ? Number(body.assignedTo) : member.memberId;
  if (!Number.isSafeInteger(assignedTo) || assignedTo < 1) return NextResponse.json({ error: "Invalid assignee." }, { status: 400 });
  if (!canAssign && member.role === "Viewer") return NextResponse.json({ error: "Your role cannot create tasks." }, { status: 403 });
  try {
    const sql = bmsDb();
    const active = await sql`SELECT id FROM bms_team_members WHERE id=${assignedTo} AND status='active' LIMIT 1`;
    if (!active.length) return NextResponse.json({ error: "Assignee must be an active team member." }, { status: 400 });
    const rows = await sql`INSERT INTO bms_tasks(title,description,priority,assigned_to,created_by_member_id,due_at)
      VALUES(${title},${description},${priority},${assignedTo},${member.memberId},${dueAt ? dueAt.toISOString() : null})
      RETURNING id,title,description,status,priority,assigned_to,due_at,created_at`;
    const task = rows[0];
    await sql`INSERT INTO bms_activity_log(actor_member_id,action,entity_type,entity_id,summary)
      VALUES(${member.memberId},'task_created','task',${String(task.id)},${"Created task: "+title})`;
    if (assignedTo !== member.memberId) {
      await sql`INSERT INTO bms_notifications(member_id,notification_type,title,body,target_url)
        VALUES(${assignedTo},'task_assigned','New task assigned',${title},'/team/tasks')`;
    }
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    console.error("BMS task create failed:", error);
    return NextResponse.json({ error: "Could not create task. Check the Preview database migration." }, { status: 503 });
  }
}
