"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
type Member={id:number;full_name:string;email:string;role:string;status:string;created_at:string;approved_at:string|null;last_login_at:string|null};
const roles=["Admin","Team Leader","Sales Executive","Viewer"];
const statusTone=(s:string)=>s==="active"?"#087443":s==="pending"?"#9a6100":s==="suspended"?"#b42318":"#53627e";
export default function TeamManager(){
 const [members,setMembers]=useState<Member[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [fullName,setFullName]=useState(""),[email,setEmail]=useState(""),[role,setRole]=useState("Viewer"),[inviteUrl,setInviteUrl]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await fetch("/api/admin/bms/team",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load team.");setMembers(d.members||[]);}catch(e){setError(e instanceof Error?e.message:"Could not load team.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function create(e:FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");try{const r=await fetch("/api/admin/bms/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName,email,role})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not create member.");setFullName("");setEmail("");setRole("Viewer");setInviteUrl(d.invitationUrl||"");setNotice("Invitation created. Share the link with the team member; after password setup, approve their account.");await load();}catch(e){setError(e instanceof Error?e.message:"Could not create member.");}finally{setSaving(false);}}
 async function act(id:number,action:string,nextRole?:string){setError("");setNotice("");try{const r=await fetch("/api/admin/bms/team",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,role:nextRole})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Update failed.");setNotice("Team member updated.");await load();}catch(e){setError(e instanceof Error?e.message:"Update failed.");}}
 return <main style={{padding:34,maxWidth:1180,margin:"0 auto",color:"#14213d"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:26}}>
   <div><div style={{fontSize:12,fontWeight:800,letterSpacing:".12em",color:"#5371a6",textTransform:"uppercase"}}>Business Management</div><h1 style={{fontSize:30,margin:"7px 0",fontWeight:850}}>Team Management</h1><p style={{margin:0,color:"#66738e"}}>Add team members, assign roles and control access approval.</p></div>
   <button onClick={()=>void load()} style={btn("#fff","#315ca8")}>Refresh</button>
  </div>
  <section style={panel}><h2 style={h2}>Add a team member</h2><p style={muted}>Create an invitation link valid for 7 days. The member sets a password, then waits for your approval before login is enabled.</p>
   <form onSubmit={create} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,alignItems:"end"}}>
    <label style={field}>Full name<input required minLength={2} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Team member name" style={input}/></label>
    <label style={field}>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" style={input}/></label>
    <label style={field}>Role<select value={role} onChange={e=>setRole(e.target.value)} style={input}>{roles.map(x=><option key={x}>{x}</option>)}</select></label>
    <button disabled={saving} type="submit" style={{...btn("#245fe8","#fff"),height:44,opacity:saving?0.6:1}}>{saving?"Adding…":"Add member"}</button>
   </form>
  </section>
  {error&&<p role="alert" style={{...alert,background:"#fff1f0",color:"#a12b22"}}>{error}</p>}
  {notice&&<p role="status" style={{...alert,background:"#ecfdf3",color:"#087443"}}>{notice}</p>}{inviteUrl&&<section style={{...panel,marginTop:14,borderColor:"#b8d1ff"}}><strong style={{fontSize:13}}>One-time invitation link</strong><p style={{fontSize:12,color:"#66738e"}}>Copy and send this link privately. It expires in 7 days and can only be used once.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input readOnly value={inviteUrl} style={{...input,flex:1,minWidth:220}}/><button type="button" onClick={()=>void navigator.clipboard.writeText(inviteUrl)} style={btn("#245fe8","#fff")}>Copy link</button></div></section>}
  <section style={{...panel,marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h2 style={h2}>Team members</h2><span style={muted}>{members.length} member(s)</span></div>
   {loading?<p style={muted}>Loading team…</p>:members.length===0?<p style={muted}>No team members yet. Add the first member above.</p>:
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr>{["Member","Role","Status","Added","Actions"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
     {members.map(m=><tr key={m.id}><td style={td}><strong>{m.full_name}</strong><div style={{fontSize:12,color:"#71809b"}}>{m.email}</div></td>
      <td style={td}><select aria-label={"Role for "+m.full_name} value={m.role} disabled={m.status==="rejected"} onChange={e=>void act(m.id,"role",e.target.value)} style={{...input,padding:"7px 9px",minWidth:140}}>{roles.map(x=><option key={x}>{x}</option>)}</select></td>
      <td style={td}><span style={{fontWeight:800,color:statusTone(m.status),background:"#f3f6fb",padding:"6px 10px",borderRadius:20,fontSize:12}}>{m.status}</span></td><td style={td}>{new Date(m.created_at).toLocaleDateString()}</td>
      <td style={td}><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
       {m.status==="pending"||m.status==="invited"?<><button onClick={()=>void act(m.id,"approve")} style={small("#e9f8ef","#087443")}>Approve</button><button onClick={()=>void act(m.id,"reject")} style={small("#fff1f0","#a12b22")}>Reject</button></>:null}
       {m.status==="active"?<button onClick={()=>void act(m.id,"suspend")} style={small("#fff1f0","#a12b22")}>Suspend</button>:null}
       {m.status==="suspended"?<button onClick={()=>void act(m.id,"reactivate")} style={small("#e9f8ef","#087443")}>Reactivate</button>:null}
       {m.status==="rejected"?<span style={{color:"#8994a8",fontSize:12}}>No actions</span>:null}
      </div></td></tr>)}
    </tbody></table></div>}
  </section>
 </main>;
}
const panel:CSSProperties={background:"#fff",border:"1px solid #e5eaf4",borderRadius:18,padding:22,boxShadow:"0 8px 28px rgba(24,48,92,.04)"};
const h2:CSSProperties={fontSize:18,fontWeight:800,margin:"0 0 10px"};
const muted:CSSProperties={fontSize:13,color:"#71809b",margin:"0 0 17px"};
const field:CSSProperties={display:"grid",gap:7,fontSize:12,fontWeight:750,color:"#53627e"};
const input:CSSProperties={height:42,border:"1px solid #dce4f1",borderRadius:10,padding:"0 12px",fontSize:13,color:"#1a2a4b",background:"#fff",width:"100%"};
const btn=(bg:string,color:string):CSSProperties=>({border:"1px solid #e0e6f0",borderRadius:10,padding:"11px 17px",fontWeight:800,background:bg,color,cursor:"pointer"});
const small=(bg:string,color:string):CSSProperties=>({border:0,borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:800,background:bg,color,cursor:"pointer"});
const th:CSSProperties={textAlign:"left",fontSize:11,color:"#8290a8",textTransform:"uppercase",letterSpacing:".07em",padding:"12px 10px",borderBottom:"1px solid #e8edf5"};
const td:CSSProperties={padding:"13px 10px",fontSize:13,borderBottom:"1px solid #edf1f7",verticalAlign:"middle"};
const alert:CSSProperties={padding:12,borderRadius:10,fontSize:13,fontWeight:650};
