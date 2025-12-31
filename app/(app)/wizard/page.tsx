"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { AlertTriangle, HeartPulse, Sparkles, Stethoscope } from "lucide-react";

const filters = [
  { label: "No barbells", type: "equipment" },
  { label: "Protect knees", type: "injury" },
  { label: "Low impact", type: "style" },
  { label: "Dumbbells OK", type: "equipment" }
];

export default function WizardPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Constraint wizard</h2>
        <Chip variant="success">Beta</Chip>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <Sparkles size={18} className="text-brand-200" />
          Guided generator balances injuries, equipment, and goals.
        </div>

        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Primary goal
          </label>
          <Input placeholder="e.g. Rebuild quad strength, low impact" />
        </div>

        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Constraints
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Chip key={filter.label}>{filter.label}</Chip>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="border border-dashed border-slate-700 text-xs"
            >
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Medical considerations
          </label>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <Stethoscope size={18} className="text-amber-300" />
              Post-ACL repair · avoid deep flexion past 90°
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <HeartPulse size={18} className="text-emerald-300" />
              Cardio capacity: Zone 2 focus this block
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() =>
            toast({
              title: "Program draft queued",
              description:
                "We will sync a tailored block. You can edit offline and push later."
            })
          }
        >
          Generate block
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-300" />
            <span className="text-sm font-semibold text-white">Risk guard</span>
          </div>
          <Chip variant="warning">Live</Chip>
        </div>
        <p className="text-sm text-slate-300">
          We will avoid knee valgus triggers and flag moves that violate your
          constraints before they enter the plan.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div className="rounded-xl bg-slate-900/70 p-3">
            <p className="font-semibold text-white">Under review</p>
            <p>Bulgarian split squats</p>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-3">
            <p className="font-semibold text-white">Suggested swap</p>
            <p>Step-ups + sled drags</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
