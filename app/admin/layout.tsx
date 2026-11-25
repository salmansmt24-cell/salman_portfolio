import "./admin-pages.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Panel | JS Salman", robots: { index: false, follow: false, noarchive: true } };
import { getAdminSession } from "@/lib/admin-auth";
import AdminChrome from "./admin-chrome";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) return <>{children}</>;
  return <AdminChrome>{children}</AdminChrome>;
}
