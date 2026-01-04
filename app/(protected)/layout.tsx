import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { NotificationCenter } from "@/components/layout/notification-center";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adaptabuddy",
  description: "Adaptive training companion."
};

export default function AppLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-28 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Adaptabuddy
          </p>
          <h1 className="text-2xl font-semibold text-white">Your workout hub</h1>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <div className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
            Offline ready
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-4 pb-6">{children}</main>
      <BottomNav />
    </div>
  );
}
