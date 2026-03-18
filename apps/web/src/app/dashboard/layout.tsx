import type { Metadata } from "next";
import { Suspense } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

export const metadata: Metadata = {
  title: "CEREBRO — Command Center",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-layout">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="dash-main">
        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}
