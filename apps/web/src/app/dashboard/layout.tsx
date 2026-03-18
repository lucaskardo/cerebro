import type { Metadata } from "next";
import { Suspense } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "CEREBRO — Command Center",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let sites: Awaited<ReturnType<typeof api.sites>> = [];
  try {
    sites = await api.sites();
  } catch {
    sites = [];
  }

  return (
    <div className="dash-layout">
      <Suspense fallback={null}>
        <Sidebar sites={sites} />
      </Suspense>
      <div className="dash-main">
        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}
