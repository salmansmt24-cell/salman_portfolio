"use client";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
export default function AdminLoginPage(){
 const [username,setUsername]=useState(""),[password,setPassword]=useState(""),[totp,setTotp]=useState(""),[requiresTotp,setRequiresTotp]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const router=useRouter();
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setBusy(true);try{const response=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password,totp})});const data=await response.json();if(!response.ok){if(data.requiresTwoFactor)setRequiresTotp(true);throw new Error(data.error||"Login failed.")}router.replace(data.redirectTo||"/admin");router.refresh()}catch(err){setError(err instanceof Error?err.message:"Unable to sign in.")}finally{setBusy(false)}}
 const field:React.CSSProperties={boxSizing:"border-box",width:"100%",padding:14,margin:"8px 0 18px",border:"1px solid #d7e1ee",borderRadius:10,fontSize:15};
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 20% 10%,#e2ebff 0,#f6f8fd 44%,#f4f2ff 100%)",fontFamily:"Inter,Arial,sans-serif"}}>
 <form onSubmit={submit} style={{width:"100%",maxWidth:430,background:"#fff",padding:34,borderRadius:20,boxShadow:"0 22px 70px #18345c16",border:"1px solid #e4eaf4"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:39,height:39,borderRadius:12,display:"grid",placeItems:"center",background:"#edf0ff",color:"#635dc0",fontWeight:900,fontSize:18}}>S</div><div><div style={{fontSize:12,fontWeight:800,color:"#344e83",letterSpacing:1.2}}>JS SALMAN PORTFOLIO</div><div style={{fontSize:10,color:"#98a4b6",marginTop:3}}>Secure admin workspace</div></div></div>
 <h1 style={{fontSize:27,color:"#172b4d",margin:"24px 0 7px"}}>Welcome back</h1><p style={{color:"#7c8ba2",fontSize:12,marginBottom:24}}>Sign in to manage your portfolio and business workspace.</p>
 <label style={{display:"block",fontSize:12,fontWeight:700,color:"#34445d"}}>Username</label><input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} style={field}/>
 <label style={{display:"block",fontSize:12,fontWeight:700,color:"#34445d"}}>Password</label><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={field}/>
 {requiresTotp&&<><label style={{display:"block",fontSize:12,fontWeight:700,color:"#34445d"}}>Authenticator code</label><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,""))} placeholder="6-digit code" style={field}/></>}
 {error&&<p role="alert" style={{color:"#b42318",fontSize:12,margin:"0 0 14px"}}>{error}</p>}
 <button disabled={busy} style={{width:"100%",padding:14,border:0,borderRadius:10,background:"#315eb5",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",opacity:busy ? 0.7 : 1}}>{busy?"Verifying…":requiresTotp?"Verify & sign in":"Sign in securely"}</button>
 <p style={{fontSize:11,color:"#929eb0",marginTop:20,textAlign:"center"}}>Protected administrator access · Production</p></form></main>;
}
