"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  { title: "Workspace", links: [
    ["Overview", "/admin", "⌂"], ["Content editor", "/admin/content", "✎"], ["Collections", "/admin/collections", "▦"],
  ]},
  { title: "Business", links: [
    ["Fiverr orders", "/admin/manage/orders", "↗"], ["Fiverr profiles", "/admin/manage/profiles", "◎"],
    ["Messages", "/admin/manage/messages", "✉"], ["Analytics", "/admin/analytics", "▥"],
    ["Sales insights", "/admin/reports/insights", "◉"], ["Intelligence V4", "/admin/reports/intelligence", "✧"],
  ]},
  { title: "Assets & tools", links: [
    ["Media library", "/admin/media", "▧"], ["Private templates", "/admin/manage/templates", "▤"],
    ["Monthly Plus", "/admin/monthly-plus", "▦"], ["Google Sheets Sync", "/admin/sync", "↻"],
    ["Account & security", "/admin/account", "⚙"],
  ]},
];

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/login")) return <>{children}</>;
  return <div className="admin-workspace">
    <aside className="admin-global-sidebar" aria-label="Admin navigation">
      <Link href="/admin" className="admin-global-brand">
        <span className="admin-global-mark">S</span>
        <span><strong>JS SALMAN</strong><small>Portfolio workspace</small></span>
      </Link>
      <div className="admin-global-nav">
        {groups.map(group => <section className="admin-global-group" key={group.title}>
          <h2>{group.title}</h2>
          {group.links.map(([label, href, icon]) => {
            const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
            return <Link key={href} href={href} className={active ? "admin-global-link active" : "admin-global-link"} aria-current={active ? "page" : undefined}>
              <span className="admin-global-icon" aria-hidden="true">{icon}</span><span>{label}</span>{active && <span className="admin-global-current" />}
            </Link>;
          })}
        </section>)}
      </div>
      <div className="admin-global-footer"><span className="admin-global-status" /> Secure workspace <small>Preview environment</small></div>
    </aside>
    <div className="admin-workspace-content">{children}</div>
  </div>;
}
