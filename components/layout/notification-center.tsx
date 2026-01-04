"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { NotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const levelCopy: Record<NotificationItem["level"], { tone: string; label: string }> = {
  info: { tone: "text-brand-100 bg-brand-500/15 border-brand-500/40", label: "Info" },
  warning: { tone: "text-amber-200 bg-amber-500/15 border-amber-500/40", label: "Warning" },
  critical: { tone: "text-red-200 bg-red-500/15 border-red-500/40", label: "Alert" }
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load notifications");
      }
      const payload = (await response.json()) as { notifications?: NotificationItem[] };
      setNotifications(payload.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const alertCount = useMemo(
    () => notifications.filter((item) => item.level !== "info").length,
    [notifications]
  );

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "relative h-10 rounded-full px-3 text-slate-200",
          alertCount > 0 ? "bg-amber-500/10 text-amber-100" : "bg-slate-900/70"
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell size={18} className="mr-2" />
        <span className="hidden sm:inline">Notifications</span>
        {notifications.length > 0 && (
          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-100">
            {notifications.length}
          </span>
        )}
      </Button>

      {open && (
        <Card className="absolute right-0 z-40 mt-3 w-96 max-w-[90vw] border border-slate-800 bg-slate-950/95 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-brand-100" />
              <p className="text-sm font-semibold text-white">Notification center</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-slate-300"
                onClick={() => void fetchNotifications()}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-slate-400"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            {notifications.length === 0 && !loading && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-300" />
                You are all caught up.
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-300">
                <Loader2 size={16} className="animate-spin text-brand-100" />
                Updating notifications...
              </div>
            )}

            {notifications.map((item) => {
              const tone = levelCopy[item.level];
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <Chip className={cn("border px-2 py-0.5 text-xs", tone.tone)}>
                      {tone.label}
                    </Chip>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">
                      {item.type.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-slate-300">{item.message}</p>
                  {item.actions && item.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.actions.map((action) => (
                        <a
                          key={action.href + action.label}
                          href={action.href}
                          className="text-xs text-brand-100 underline hover:text-brand-200"
                        >
                          {action.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
