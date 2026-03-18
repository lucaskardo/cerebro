import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import AttributionTracker from "@/components/AttributionTracker";

export const metadata: Metadata = {
  title: "CEREBRO v7",
  description: "Growth Operating System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-900 text-slate-100">
        <Suspense fallback={null}><AttributionTracker /></Suspense>
        {children}
      </body>
    </html>
  );
}
