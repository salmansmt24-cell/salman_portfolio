import { redirect } from "next/navigation";
import { getBmsSession } from "@/lib/bms-auth";
export const dynamic="force-dynamic";
export default async function TeamHome(){
 const member=await getBmsSession();if(!member)redirect("/team/login");
 return <main style={{minHeight:"100vh",background:"#f3f6fc",padding:32,fontFamily:"Arial,sans-serif",color:"#17233d"}}><div style={{maxWidth:1000,margin:"0 auto",background:"#fff",padding:28,borderRadius:18,border:"1px solid #e3e9f3"}}><div style={{fontSize:12,fontWeight:800,letterSpacing:".12em",color:"#315ca8"}}>BUSINESS MANAGEMENT SYSTEM</div><h1 style={{fontSize:30,margin:"10px 0"}}>Welcome, {member.fullName}</h1><p style={{color:"#68758c"}}>Your team account is active. Your role: <strong>{member.role}</strong>.</p><p style={{fontSize:14,color:"#68758c"}}>Team dashboard modules and role-based task access will be added in the next stage.</p><form action="/api/bms/auth/logout" method="post"><button style={{border:0,borderRadius:9,padding:"11px 18px",background:"#17233d",color:"#fff",fontWeight:700,cursor:"pointer"}}>Sign out</button></form></div></main>;
}
