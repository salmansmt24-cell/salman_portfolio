"use client";

import { useEffect, useMemo, useState } from "react";

type Sale = { month: string; orderDate: string; orderId: string; salesId: string; buyer: string; salesPerson: string; department: string; status: string; salesType: string; sales: number };
type Payload = { ok: boolean; currentMonth: string; months: string[]; rows: Sale[]; updatedAt: string; error?: string };
const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
};
const shortDate = (value: string) => {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
};

export default function MonthlySalesClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/monthly-sales", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Sales data load failed.");
      setData(payload);
      setSelectedMonth(payload.currentMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Google Sheets data.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => (data?.rows || []).filter(row => row.month === selectedMonth).sort((a, b) => b.orderDate.localeCompare(a.orderDate)), [data, selectedMonth]);
  const total = rows.reduce((sum, row) => sum + row.sales, 0);
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(row => map.set(row.orderDate.slice(0, 10), (map.get(row.orderDate.slice(0, 10)) || 0) + row.sales));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const maxDaily = Math.max(1, ...daily.map(([, value]) => value));
  const people = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(row => map.set(row.salesPerson || "Unassigned", (map.get(row.salesPerson || "Unassigned") || 0) + row.sales));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return <main className="monthly-sales-page">
    <header className="monthly-sales-header">
      <div><span className="monthly-sales-kicker">SALES REPORTING</span><h1>Monthly Sales</h1><p>Google Sheets থেকে সরাসরি আপডেট হওয়া মাসিক Sales রিপোর্ট।</p></div>
      <button onClick={() => void load()} disabled={loading} className="monthly-refresh">{loading ? "Loading…" : "↻ Refresh data"}</button>
    </header>
    {error && <div className="monthly-error" role="alert">{error}</div>}
    {loading && !data ? <div className="monthly-state">Google Sheets থেকে Sales data লোড হচ্ছে…</div> : data && <>
      <section className="monthly-toolbar">
        <div><span>Selected reporting month</span><strong>{selectedMonth ? monthLabel(selectedMonth) : "—"}</strong></div>
        <select aria-label="Select sales month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {[...new Set([data.currentMonth, ...data.months])].sort().reverse().map(month => <option key={month} value={month}>{monthLabel(month)}{month === data.currentMonth ? " · Current" : ""}</option>)}
        </select>
      </section>
      <section className="monthly-kpis">
        <article className="monthly-kpi monthly-kpi-primary"><span>Total sales this month</span><strong>{money(total)}</strong><small>{monthLabel(selectedMonth)} · Google Sheets</small></article>
        <article className="monthly-kpi"><span>Total orders</span><strong>{rows.length.toLocaleString("en-US")}</strong><small>Orders recorded in this month</small></article>
        <article className="monthly-kpi"><span>Average sales / order</span><strong>{money(rows.length ? total / rows.length : 0)}</strong><small>Based on {rows.length} order(s)</small></article>
      </section>
      <section className="monthly-content-grid">
        <article className="monthly-card">
          <div className="monthly-card-head"><div><h2>Daily sales</h2><p>Sales amount by order date</p></div><b>{money(total)}</b></div>
          {daily.length ? <div className="monthly-bars">{daily.map(([day, value]) => <div className="monthly-bar-item" key={day} title={shortDate(day) + ": " + money(value)}><div className="monthly-bar-track"><i style={{ height: Math.max(4, value / maxDaily * 100) + "%" }} /></div><span>{Number(day.slice(8, 10))}</span></div>)}</div> : <div className="monthly-empty">এই মাসে কোনো Sales record পাওয়া যায়নি।</div>}
        </article>
        <article className="monthly-card">
          <div className="monthly-card-head"><div><h2>Sales by person</h2><p>Sales person অনুযায়ী breakdown</p></div></div>
          {people.length ? people.map(([name, value]) => <div className="monthly-person" key={name}><div><span>{name}</span><strong>{money(value)}</strong></div><div className="monthly-progress"><i style={{ width: (total ? value / total * 100 : 0) + "%" }} /></div></div>) : <div className="monthly-empty">No sales records for this month.</div>}
        </article>
      </section>
      <section className="monthly-card monthly-table-card">
        <div className="monthly-card-head"><div><h2>Sales records</h2><p>শুধু নির্বাচিত মাসের Google Sheets data দেখানো হচ্ছে</p></div><b>{rows.length} orders</b></div>
        {rows.length ? <div className="monthly-table-wrap"><table><thead><tr><th>Order date</th><th>Order ID</th><th>Buyer</th><th>Sales person</th><th>Department</th><th>Status</th><th className="number">Sales amount</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.salesId || row.orderId || i}><td>{shortDate(row.orderDate)}</td><td>{row.orderId}</td><td>{row.buyer || "—"}</td><td>{row.salesPerson || "—"}</td><td>{row.department || "—"}</td><td><span className="monthly-status">{row.status || "—"}</span></td><td className="number">{money(row.sales)}</td></tr>)}</tbody></table></div> : <div className="monthly-empty">এই মাসে কোনো Sales record নেই। অন্য মাস দেখতে উপরের selector ব্যবহার করো।</div>}
      </section>
      <footer className="monthly-footnote">Source: Google Sheets · Timezone: Asia/Dhaka · Last loaded: {new Date(data.updatedAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}. মাস পরিবর্তন হলে বর্তমান মাস স্বয়ংক্রিয়ভাবে নির্বাচিত হবে।</footer>
    </>}
  </main>;
}
