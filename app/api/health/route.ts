import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
export const runtime = "nodejs";
export async function GET(){ if(!process.env.DATABASE_URL) return NextResponse.json({ok:false,database:"missing DATABASE_URL"},{status:503}); try { const sql=neon(process.env.DATABASE_URL); await sql`SELECT 1`; return NextResponse.json({ok:true,database:"connected"}); } catch { return NextResponse.json({ok:false,database:"connection failed"},{status:503}); } }
