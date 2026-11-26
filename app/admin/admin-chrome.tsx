"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Dashboard", "/admin", "⌂"],
  ["Team Management", "/admin/team", "♧"],
  ["BMS Order Review", "/admin/bms/orders", "✓"],
  ["BMS Reports", "/admin/bms/reports", "▥"],
  ["Manage Content", "/admin/content", "▣"],
  ["Orders", "/admin/manage/orders", "▱"],
  ["Messages", "/admin/manage/messages", "◉"],
  ["Portfolio", "/admin/collections", "▤"],
  ["Fiverr Profiles", "/admin/manage/profiles", "♙"],
  ["Analytics", "/admin/analytics", "▥"],
  ["Monthly Sales", "/admin/monthly-sales", "$"],
  ["Appearance", "/admin/media", "◈"],
  ["Tools", "/admin/sync", "⚒"],
  ["Settings", "/admin/account", "⚙"],
] as const;

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/login")) return <>{children}</>;
  return <div className="admin-workspace">
    <aside className="admin-global-sidebar" aria-label="Admin navigation">
      <Link href="/admin" className="admin-global-brand">
        <span className="admin-global-mark"><i /><b /></span>
        <span><strong>Md. Salman</strong><small>Admin Panel</small></span>
      </Link>
      <nav className="admin-global-nav">
        {links.map(([label, href, icon]) => {
          const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return <Link key={href} href={href} className={active ? "admin-global-link active" : "admin-global-link"} aria-current={active ? "page" : undefined}>
            <span className="admin-global-icon" aria-hidden="true">{icon}</span><span>{label}</span>{label === "Manage Content" || label === "Settings" || label === "Appearance" || label === "Tools" ? <span className="admin-global-chevron">›</span> : null}
          </Link>;
        })}
      </nav>
      <div className="admin-global-promo">
        <div className="admin-promo-orbit" />
        <span className="admin-promo-rocket">🚀</span>
        <strong>Build Something<br/>Amazing!</strong>
        <p>Keep going, you’re doing<br/>great!</p>
        <Link href="/">View Site <span>→</span></Link>
      </div>
      <div className="admin-global-footer">© {new Date().getFullYear()} Md. Salman</div>
    </aside>
    <div className="admin-workspace-content">{children}</div>
  </div>;
}
