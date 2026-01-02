"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  Activity,
  Compass,
  Dumbbell,
  Settings,
  LibraryBig
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: typeof Dumbbell;
};

const items: NavItem[] = [
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/wizard", label: "Wizard", icon: Compass },
  { href: "/kpi", label: "KPI", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 bg-slate-900/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-4xl items-center justify-around gap-2 px-4 py-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition",
                active
                  ? "bg-brand-500/20 text-brand-100"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              )}
            >
              <Icon size={20} strokeWidth={2.4} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/library/exercises"
          className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-100"
        >
          <LibraryBig size={20} strokeWidth={2.4} />
          <span>Library</span>
        </Link>
      </div>
    </nav>
  );
}
