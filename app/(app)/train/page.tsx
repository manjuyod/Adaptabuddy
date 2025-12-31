"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast-provider";
import { Activity, Flame, Play, Sparkles, Timer } from "lucide-react";

const quickSessions = [
  {
    title: "Adaptive Push",
    focus: "Upper / Push",
    est: "42m",
    intensity: "Medium"
  },
  {
    title: "Hybrid Conditioning",
    focus: "Full body",
    est: "35m",
    intensity: "High"
  },
  {
    title: "Core Stability",
    focus: "Core / Balance",
    est: "18m",
    intensity: "Low"
  }
];

export default function TrainPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-5">
      <Card className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-300">Today&apos;s readiness</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-white">78</span>
            <Chip variant="success">Recovered</Chip>
          </div>
          <p className="text-xs text-slate-400">
            Auto-tunes volume and rest. Pauses offline-friendly logging.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Toggle
            aria-label="Enable adaptive mode"
            checked
            onCheckedChange={(checked) => {
              toast({
                title: checked ? "Adaptive mode on" : "Adaptive mode off",
                description:
                  checked
                    ? "We will auto-adjust sets, tempo, and rest."
                    : "Switch back anytime."
              });
            }}
          />
          <div className="flex items-center gap-1 text-xs text-amber-300">
            <Sparkles size={16} /> AI tuned
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Quick start</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-slate-300"
            onClick={() =>
              toast({
                title: "Coming next",
                description: "Program generator and offline queue arrive soon."
              })
            }
          >
            View all
          </Button>
        </div>
        {quickSessions.map((session) => (
          <Card
            key={session.title}
            className="flex items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Play size={16} className="text-brand-200" />
                <p className="text-base font-semibold text-white">
                  {session.title}
                </p>
              </div>
              <p className="text-sm text-slate-300">
                {session.focus} · {session.intensity}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Timer size={14} /> {session.est}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                toast({
                  title: `Starting ${session.title}`,
                  description: "Logging will sync when back online.",
                  actionLabel: "Open log"
                })
              }
            >
              Start
            </Button>
          </Card>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Signals</h2>
          <Chip variant="warning">Live</Chip>
        </div>
        <Card>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
            <div className="rounded-xl bg-slate-900/80 p-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Flame size={14} /> Strain
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">Mod</p>
              <p className="text-xs text-slate-400">Hold pace today.</p>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Activity size={14} /> HRV
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">High</p>
              <p className="text-xs text-slate-400">Great recovery window.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
