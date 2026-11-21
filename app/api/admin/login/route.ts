import { NextRequest, NextResponse } from "next/server";
import { createSession, setAdminCookie, verifyAdminPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({error:"Request rejected."},{status:403});
  let body: {username?:string;password?:string};
  try { body = await request.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  const username = String(body.username ?? "").trim().slice(0,100);
  const password = String(body.password ?? "");
  if (!username || !password || password.length > 1024) return NextResponse.json({error:"Username and password are required."},{status:400});
  try {
    const valid = await verifyAdminPassword(username,password);
    if (!valid) return NextResponse.json({error:"Invalid username or password."},{status:401});
    await setAdminCookie(createSession(username));
    return NextResponse.json({ok:true,redirectTo:"/admin"});
  } catch (error) {
    console.error("Admin login failed:", error);
    return NextResponse.json({error:"Admin login is temporarily unavailable. Check server configuration."},{status:503});
  }
}
