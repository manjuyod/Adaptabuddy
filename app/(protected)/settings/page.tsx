"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast-provider";
import type { RescheduleResponse } from "@/lib/train/types";
import { AlertTriangle, RefreshCw, RotateCcw, ShieldCheck, Shuffle, WifiOff, Zap } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [offlineMode, setOfflineMode] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isRestarting, setIsRestarting] = useState<null | "auto" | "soft" | "hard">(null);
  const [reshuffleSeed, setReshuffleSeed] = useState(false);

  const runReschedule = async (mode: "auto" | "soft" | "hard") => {
    setIsRestarting(mode);
    try {
      const response = await fetch("/api/reschedule/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          reshuffle: mode !== "auto" ? reshuffleSeed : undefined
        })
      });
      const payload = (await response.json()) as RescheduleResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Reschedule failed");
      }
      toast({
        title: mode === "auto" ? "Auto-reschedule triggered" : `${mode} restart run`,
        description: `Missed ${payload.missed ?? 0}, created ${payload.created ?? 0}`
      });
    } catch (error) {
      toast({
        title: "Reschedule failed",
        description: error instanceof Error ? error.message : "Unable to run reschedule."
      });
    } finally {
      setIsRestarting(null);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-white">Settings</h2>

      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">Profile</p>
          <Input placeholder="Name" defaultValue="Training partner" />
          <Input placeholder="Email" defaultValue="you@example.com" />
        </div>
        <Button className="w-full">Save profile</Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Offline-first</p>
            <p className="text-sm text-slate-400">
              Cache workouts; queue logs to IndexedDB.
            </p>
          </div>
          <Toggle
            checked={offlineMode}
            onCheckedChange={(checked) => {
              setOfflineMode(checked);
              toast({
                title: checked
                  ? "Offline cache enabled"
                  : "Offline cache paused",
                description: "Future sessions will sync when back online."
              });
            }}
            aria-label="Toggle offline mode"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-900/70 p-3 text-xs text-slate-300">
          <WifiOff size={16} className="text-amber-300" />
          Stays usable without connectivity; queues writes securely.
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Push notifications</p>
            <p className="text-sm text-slate-400">
              Session reminders and recovery nudges.
            </p>
          </div>
          <Toggle
            checked={pushEnabled}
            onCheckedChange={(checked) => {
              setPushEnabled(checked);
              toast({
                title: checked ? "Push enabled" : "Push disabled",
                description: checked
                  ? "We will request permission on next load."
                  : "You can re-enable anytime."
              });
            }}
            aria-label="Toggle push notifications"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-900/70 p-3 text-xs text-slate-300">
          <Zap size={16} className="text-emerald-300" />
          Uses a minimal worker hook; ready for Web Push wiring.
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Program maintenance</p>
            <p className="text-sm text-slate-400">
              Auto-reschedule missed sessions or restart this week.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Toggle
              checked={reshuffleSeed}
              onCheckedChange={(checked) => setReshuffleSeed(checked)}
              aria-label="Toggle seed reshuffle"
            >
              <Shuffle size={14} />
            </Toggle>
            <span>Reshuffle</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runReschedule("auto")}
            disabled={isRestarting !== null}
          >
            {isRestarting === "auto" ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Auto-reschedule
          </Button>
          <Button
            size="sm"
            onClick={() => void runReschedule("soft")}
            disabled={isRestarting !== null}
          >
            {isRestarting === "soft" ? (
              <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Soft restart
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-200"
            onClick={() => void runReschedule("hard")}
            disabled={isRestarting !== null}
          >
            {isRestarting === "hard" ? (
              <AlertTriangle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="mr-2 h-4 w-4" />
            )}
            Hard restart
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Soft restart keeps completed history; hard restart archives planned sessions as skipped.
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-slate-200">
          <ShieldCheck size={18} className="text-emerald-400" />
          <p className="text-sm font-semibold">Security</p>
        </div>
        <p className="text-sm text-slate-300">
          Sessions rely on Supabase secure cookies. Tokens refresh via middleware
          for SSR routes.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full bg-slate-900 px-3 py-1">
            Encrypted at rest
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1">
            HttpOnly cookies
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1">
            Row-level ready
          </span>
        </div>
      </Card>
    </div>
  );
}
