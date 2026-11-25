import { NextRequest,NextResponse } from "next/server";
import { bmsDb,clearBmsCookie,hashBmsToken } from "@/lib/bms-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin"),host=req.headers.get("host");
 if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:"Request rejected."},{status:403});}catch{return NextResponse.json({error:"Request rejected."},{status:403});}}
 const token=(await import("next/headers")).cookies;
 const value=(await token()).get("bms_team_session")?.value;
 if(value){try{const sql=bmsDb();await sql\`UPDATE bms_user_sessions SET revoked_at=NOW() WHERE session_token_hash=\${hashBmsToken(value)} AND revoked_at IS NULL\`;}catch(e){console.error("BMS logout failed:",e);}}
 await clearBmsCookie();
 return NextResponse.redirect(new URL("/team/login",req.url),303);
}
