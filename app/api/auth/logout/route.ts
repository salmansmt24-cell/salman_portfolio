import { NextRequest, NextResponse } from "next/server";
import { clearUserSession } from "@/lib/user-auth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
  await clearUserSession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
