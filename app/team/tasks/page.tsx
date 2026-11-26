"use client";
import { useCallback,useEffect,useState } from "react";
import type { FormEvent } from "react";
import TaskComments from "./task-comments";
type Task={id:number;title:string;description:string;status:string;priority:string;assigned_to:number|null;due_at:string|null;created_at:string;assignee_name?:string|null;creator_name?:string|null};
type Member={id:number;full_name:string};
const statusLabels:Record<string,string>={todo:"To do",in_progress:"In progress",review:"Review",blocked:"Blocked",completed:"Completed",cancelled:"Cancelled"};
export default function TeamTasks(){
 const [tasks,setTasks]=useState<Task[]>([]),[members,setMembers]=useState<Member[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[priority,setPriority]=useState("normal"),[dueAt,setDueAt]=useState(""),[assignedTo,setAssignedTo]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const [a,b]=await Promise.all([fetch("/api/bms/tasks",{cache:"no-store"}),fetch("/api/bms/team-options",{cache:"no-store"})]);const ad=await a.json(),bd=await b.json();if(!a.ok)throw new Error(ad.error||"Tasks could not load.");if(!b.ok)throw new Error(bd.error||"Team options could not load.");setTasks(ad.tasks||[]);setMembers(bd.members||[]);}catch(e){setError(e instanceof Error?e.message:"Could not load tasks.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function create(e:FormEvent){e.preventDefault();setError("");setMessage("");try{const r=await fetch("/api/bms/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,priority,dueAt:dueAt||null,assignedTo:assignedTo||null})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Task could not be created.");setTitle("");setDescription("");setDueAt("");setAssignedTo("");setMessage("Task created and assigned.");await load();}catch(e){setError(e instanceof Error?e.message:"Could not create task.");}}
 async function update(id:number,status:string){setError("");setMessage("");try{const r=await fetch("/api/bms/tasks/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Update failed.");setMessage("Task status updated.");await load();}catch(e){setError(e instanceof Error?e.message:"Update failed.");}}
 const card:React.CSSProperties={background:"#fff",border:"1px solid #e1e8f2",borderRadius:16,padding:18,boxShadow:"0 5px 20px rgba(18,42,78,.04)"};
 const field:React.CSSProperties={display:"grid",gap:6,fontSize:12,fontWeight:700,color:"#53627e"};
 const input:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #dce4f0",borderRadius:9,padding:"10px 12px",fontSize:13,background:"#fff",color:"#192944"};
 return <main style={{minHeight:"100vh",background:"#f4f7fc",padding:24,fontFamily:"Arial,sans-serif",color:"#17233d"}}><div style={{maxWidth:1100,margin:"0 auto"}}>
  <header style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:22}}><div><div style={{fontSize:11,fontWeight:800,letterSpacing:".13em",color:"#4267a9"}}>BUSINESS MANAGEMENT SYSTEM</div><h1 style={{fontSize:30,margin:"7px 0"}}>Task Management</h1><p style={{margin:0,color:"#71809b",fontSize:13}}>Create, assign and track your team's work.</p></div><a href="/team" style={{textDecoration:"none",background:"#fff",border:"1px solid #dce4f0",borderRadius:9,padding:"10px 14px",color:"#315ca8",fontWeight:700,fontSize:13}}>← Dashboard</a></header>
  <section style={card}><h2 style={{fontSize:18,margin:"0 0 7px"}}>Create a task</h2><p style={{fontSize:13,color:"#71809b",margin:"0 0 16px"}}>Team Leaders and Admins can assign tasks to active members. Sales Executives can create tasks for themselves.</p>
   <form onSubmit={create} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
    <label style={field}>Task title<input required minLength={3} maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} style={input} placeholder="e.g. Follow up with client"/></label>
    <label style={field}>Priority<select value={priority} onChange={e=>setPriority(e.target.value)} style={input}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
    <label style={field}>Due date<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} style={input}/></label>
    <label style={field}>Assign to<select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} style={input}><option value="">Myself / default</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
    <label style={{...field,gridColumn:"1 / -1"}}>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={8000} style={{...input,resize:"vertical"}} placeholder="Task details or instructions"/></label>
    <button type="submit" style={{border:0,borderRadius:9,padding:"12px 18px",background:"#245fe8",color:"#fff",fontWeight:800,cursor:"pointer",justifySelf:"start"}}>Create task</button>
   </form>
  </section>
  {error&&<p role="alert" style={{padding:12,borderRadius:9,background:"#fff0ef",color:"#a12b22",fontSize:13}}>{error}</p>}{message&&<p role="status" style={{padding:12,borderRadius:9,background:"#eaf8ef",color:"#087443",fontSize:13}}>{message}</p>}
  <section style={{marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={{fontSize:18,margin:0}}>Tasks</h2><button onClick={()=>void load()} style={{border:"1px solid #dce4f0",borderRadius:9,padding:"9px 13px",background:"#fff",color:"#315ca8",fontWeight:700,cursor:"pointer"}}>Refresh</button></div>
   {loading?<p style={{color:"#71809b"}}>Loading tasks…</p>:tasks.length===0?<div style={card}><p style={{margin:0,color:"#71809b"}}>No tasks yet. Create your first task above.</p></div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
    {tasks.map(t=><article key={t.id} style={card}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"start"}}><h3 style={{fontSize:16,margin:"0 0 9px"}}>{t.title}</h3><span style={{fontSize:10,fontWeight:800,padding:"5px 8px",borderRadius:20,background:t.priority==="urgent"?"#fff0ef":"#f1f5fb",color:t.priority==="urgent"?"#b42318":"#53627e",whiteSpace:"nowrap"}}>{t.priority.toUpperCase()}</span></div>
     {t.description&&<p style={{fontSize:13,color:"#66758f",whiteSpace:"pre-wrap"}}>{t.description}</p>}
     <p style={{fontSize:12,color:"#71809b"}}>Assigned: {t.assignee_name||"Unassigned"}{t.due_at?" · Due "+new Date(t.due_at).toLocaleString():""}</p>
     <label style={{...field,marginTop:10}}>Status<select value={t.status} onChange={e=>void update(t.id,e.target.value)} style={input}>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><TaskComments taskId={t.id}/>
    </article>)}
   </div>}
  </section>
 </div></main>;
}
