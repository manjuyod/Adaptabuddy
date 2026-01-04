import { Calendar, ListChecks, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import type { CurrentRunSummary } from "@/lib/home/run-summary";

const parseIsoDate = (iso: string): Date | null => {
  const parts = iso.split("-").map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

const formatDate = (iso: string): string => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
};

export function CurrentRunCard({ summary }: { summary: CurrentRunSummary }) {
  const planLabel = summary.planNames.join(" + ") || "Program mix";
  const next = summary.nextSession;
  const nextLabel = next
    ? `${next.label}${typeof next.exerciseCount === "number" ? ` (${next.exerciseCount} exercises)` : ""}`
    : "No session scheduled";
  const startedCopy = summary.planStartedAt
    ? `Started ${formatDate(summary.planStartedAt)}`
    : summary.hasProgram
      ? "Progress saved for this run"
      : "Create a plan to unlock progress tracking";

  return (
    <Card className="space-y-3 border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">Current run</p>
          <p className="text-lg font-semibold text-white">{summary.hasProgram ? planLabel : "No active program"}</p>
          <p className="text-xs text-slate-400">{startedCopy}</p>
        </div>
        <Chip variant={summary.hasProgram ? "default" : "warning"}>
          {summary.hasProgram ? `Week ${summary.weekNumber ?? "1"}` : "Idle"}
        </Chip>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-3">
          <Sparkles size={18} className="text-brand-200" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Plan</p>
            <p className="text-sm font-semibold text-white">{planLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-3">
          <Calendar size={18} className="text-emerald-200" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Next session</p>
            <p className="text-sm font-semibold text-white">
              {next ? formatDate(next.date) : "Not scheduled"}
            </p>
            <p className="text-xs text-slate-400">{nextLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-3">
          <ListChecks size={18} className="text-amber-200" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Save state</p>
            <p className="text-sm font-semibold text-white">
              {summary.lastActivityAt ? `Active ${formatDate(summary.lastActivityAt)}` : "Ready to resume"}
            </p>
            <p className="text-xs text-slate-400">
              {summary.lastCompletedAt
                ? `Last completed ${formatDate(summary.lastCompletedAt)}`
                : "No completions logged yet"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
