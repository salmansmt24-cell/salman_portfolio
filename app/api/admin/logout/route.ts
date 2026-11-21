import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/admin-auth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({error:"Request rejected."},{status:403});
  await clearAdminCookie();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
