import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Team Workspace | JS Salman",
  robots: { index: false, follow: false, noarchive: true },
};

export default function TeamLayout({ children }: { children: ReactNode }) {
  return children;
}
