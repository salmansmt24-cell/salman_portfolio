"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const response=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "Login failed.");
      router.replace(data.redirectTo || "/admin"); router.refresh();
    } catch(err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"linear-gradient(135deg,#edf4ff,#f8fbff)",fontFamily:"Arial,sans-serif"}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:420,background:"#fff",padding:36,borderRadius:20,boxShadow:"0 20px 60px #18345c18",border:"1px solid #e2eaf5"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#3867b3",letterSpacing:2}}>JS SALMAN PORTFOLIO</div>
      <h1 style={{fontSize:30,color:"#172b4d",margin:"12px 0 8px"}}>Admin Login</h1>
      <p style={{color:"#687b96",marginBottom:28}}>Sign in to manage your portfolio content.</p>
      <label style={{display:"block",fontSize:14,fontWeight:600,color:"#34445d"}}>Username</label>
      <input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} style={{boxSizing:"border-box",width:"100%",padding:14,margin:"8px 0 18px",border:"1px solid #d7e1ee",borderRadius:10,fontSize:16}}/>
      <label style={{display:"block",fontSize:14,fontWeight:600,color:"#34445d"}}>Password</label>
      <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{boxSizing:"border-box",width:"100%",padding:14,margin:"8px 0 18px",border:"1px solid #d7e1ee",borderRadius:10,fontSize:16}}/>
      {error && <p role="alert" style={{color:"#b42318",fontSize:14,margin:"0 0 14px"}}>{error}</p>}
      <button disabled={busy} style={{width:"100%",padding:15,border:0,borderRadius:10,background:"#2459a6",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",opacity:busy?.7:1}}>{busy?"Signing in…":"Sign in securely"}</button>
      <p style={{fontSize:12,color:"#8290a4",marginTop:22}}>Protected administrator access</p>
    </form>
  </main>;
}
