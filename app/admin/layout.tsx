import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-auth";
import AdminChrome from "./admin-chrome";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) return <>{children}</>;
  return <AdminChrome>{children}</AdminChrome>;
}
