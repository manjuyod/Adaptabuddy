import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Flame, TrendingUp } from "lucide-react";

const metrics = [
  { label: "Volume (7d)", value: "34,120 lb", delta: "+8%" },
  { label: "Sleep avg", value: "7h 24m", delta: "+12%" },
  { label: "HRV", value: "92 ms", delta: "+4%" }
];

export default function KpiPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Performance
          </p>
          <h2 className="text-lg font-semibold text-white">Signals & KPIs</h2>
        </div>
        <Button variant="ghost" size="sm" className="text-sm text-slate-300">
          Export
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {metric.label}
            </p>
            <p className="text-2xl font-semibold text-white">{metric.value}</p>
            <p className="text-xs text-emerald-300">{metric.delta} vs last</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-slate-200">
          <BarChart3 size={18} className="text-brand-200" />
          <span className="text-sm font-semibold">Ready vs Load</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div className="rounded-xl bg-slate-900/70 p-3">
            <div className="flex items-center gap-2">
              <Activity size={14} />
              <span>Readiness</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">High</p>
            <p className="text-slate-400">HRV + sleep trending up.</p>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-3">
            <div className="flex items-center gap-2">
              <Flame size={14} />
              <span>Strain</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">Moderate</p>
            <p className="text-slate-400">Keep density, hold intensity.</p>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} />
              <span>Trend</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">+5%</p>
            <p className="text-slate-400">2nd week upward trend.</p>
          </div>
        </div>
        <Chip variant="success">Auto-syncs when online</Chip>
      </Card>
    </div>
  );
}
