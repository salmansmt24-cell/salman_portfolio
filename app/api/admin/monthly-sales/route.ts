import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxVUREpwUQQrXmKkSGOXe2JP0eib8k8sfKu130b5e6uiX7oT7to60QrFOLZ-j24g5Vc/exec";
const TZ = "Asia/Dhaka";

function monthKey(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(date).slice(0, 7);
}
function amount(value: unknown): number {
  const parsed = Number(String(value ?? 0).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const callback = "monthlySales_" + Date.now().toString(36);
    const url = new URL(SHEETS_ENDPOINT);
    url.searchParams.set("callback", callback);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error("Google Sheets endpoint returned " + response.status);
    const body = (await response.text()).trim();

    // Apps Script may return plain JSON even when a callback is supplied.
    // Accept both plain JSON and JSONP response formats.
    let jsonText = body;
    const jsonp = body.match(/^[\w.$]+\s*\(([\s\S]*)\)\s*;?$/);
    if (jsonp) jsonText = jsonp[1].trim();
    const snapshot = JSON.parse(jsonText);

    if (!Array.isArray(snapshot?.rows) || snapshot.rows.length >= 1000 || snapshot.success === false) {
      throw new Error("Google Sheets data is unavailable or incomplete.");
    }

    const rows = snapshot.rows.map((row: any) => {
      const month = monthKey(row.order_date);
      return {
        month,
        orderDate: String(row.order_date ?? ""),
        orderId: String(row.order_id ?? ""),
        salesId: String(row.sales_id ?? ""),
        buyer: String(row.buyer ?? ""),
        salesPerson: String(row.sales_person ?? ""),
        department: String(row.department ?? ""),
        status: String(row.status ?? ""),
        salesType: String(row.sales_type ?? ""),
        sales: amount(row.sales_amount),
      };
    }).filter((row: any) => row.month && row.orderId);

    const months = [...new Set(rows.map((row: any) => row.month))].sort().reverse();
    return NextResponse.json({
      ok: true,
      currentMonth: monthNow(),
      months,
      rows,
      source: "Google Sheets",
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Monthly sales Google Sheets read failed:", error);
    return NextResponse.json({ error: "Google Sheets থেকে Sales data আনা যাচ্ছে না। Sheet access ও Apps Script endpoint পরীক্ষা করুন।" }, { status: 502 });
  }
}
