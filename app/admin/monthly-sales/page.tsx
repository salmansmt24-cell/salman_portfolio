import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import MonthlySalesClient from "./monthly-sales-client";
import "./monthly-sales.css";

export const dynamic = "force-dynamic";

export default async function MonthlySalesPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  return <MonthlySalesClient />;
}
