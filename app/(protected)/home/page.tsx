import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart2,
  Cog,
  Play,
  Timer
} from "lucide-react";
import { CurrentRunCard } from "@/components/home/current-run-card";
import { Card } from "@/components/ui/card";
import { buildCurrentRunSummary } from "@/lib/home/run-summary";
import { getSessionWithProfile } from "@/lib/supabase/server";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseIsoDate = (iso: string): Date | null => {
  const parts = iso.split("-").map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

const formatShortDate = (iso: string): string => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
};

type ActionTileProps = {
  href: Route;
  label: string;
  description: string;
  icon: typeof Play;
  accent?: string;
  disabled?: boolean;
  footnote?: string;
};

const ActionTile = ({
  href,
  label,
  description,
  icon: Icon,
  accent = "bg-brand-500/20 text-brand-100",
  disabled = false,
  footnote
}: ActionTileProps) => {
  const baseClasses =
    "group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-400/60 hover:shadow-lg";
  const content = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon size={20} strokeWidth={2.4} />
        </div>
        <ArrowRight
          size={16}
          className="text-slate-500 transition duration-150 group-hover:translate-x-1"
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
        {footnote ? <p className="text-xs text-slate-500">{footnote}</p> : null}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div className={`${baseClasses} cursor-not-allowed opacity-60`} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={baseClasses}>
      {content}
    </Link>
  );
};

export default async function HomePage() {
  const { supabase, user, profile } = await getSessionWithProfile();
  if (!user || !profile) {
    redirect("/login");
  }

  const activeProgram = isRecord(profile.active_program_json)
    ? profile.active_program_json
    : null;
  const preferences = isRecord(profile.preferences) ? profile.preferences : {};

  const runSummary = await buildCurrentRunSummary({
    supabase,
    userId: user.id,
    activeProgram,
    saveMeta: profile.save_meta_json
  });

  const daysPerWeek =
    typeof (preferences as { days_per_week?: unknown }).days_per_week === "number"
      ? (preferences as { days_per_week: number }).days_per_week
      : typeof (activeProgram as { days_per_week?: unknown })?.days_per_week === "number"
        ? (activeProgram as { days_per_week: number }).days_per_week
        : null;

  const fatigue =
    typeof (preferences as { fatigue_profile?: unknown }).fatigue_profile === "string"
      ? (preferences as { fatigue_profile: string }).fatigue_profile
      : typeof (activeProgram as { fatigue_profile?: unknown })?.fatigue_profile === "string"
        ? (activeProgram as { fatigue_profile: string }).fatigue_profile
        : null;

  const equipment =
    Array.isArray((preferences as { equipment_profile?: unknown }).equipment_profile) &&
    ((preferences as { equipment_profile: unknown[] }).equipment_profile).length > 0
      ? ((preferences as { equipment_profile: unknown[] }).equipment_profile as string[])
      : Array.isArray((activeProgram as { equipment_profile?: unknown }).equipment_profile)
        ? ((activeProgram as { equipment_profile: unknown[] }).equipment_profile as string[])
        : [];

  const continueDescription = runSummary.hasProgram
    ? runSummary.nextSession
      ? `${runSummary.nextSession.label} • ${formatShortDate(runSummary.nextSession.date)}`
      : `Week ${runSummary.weekNumber ?? 1} • Ready to log`
    : "Start a program";

  const continueFootnote = runSummary.hasProgram
    ? runSummary.planNames.join(", ")
    : "Wizard builds your plan";

  return (
    <div className="space-y-5">
      <Card className="border border-slate-800 bg-gradient-to-br from-brand-500/15 via-slate-900 to-slate-950 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-300">Start menu</p>
            <h2 className="text-2xl font-semibold text-white">Pick your next move</h2>
            <p className="text-sm text-slate-300">
              Resume your run, launch a new one, or jump into stats.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-200">
            {daysPerWeek ? (
              <span className="rounded-full bg-slate-900 px-3 py-1">
                Days/wk: {daysPerWeek}
              </span>
            ) : null}
            {fatigue ? (
              <span className="rounded-full bg-slate-900 px-3 py-1">
                Fatigue: {fatigue}
              </span>
            ) : null}
            {equipment.length > 0 ? (
              <span className="rounded-full bg-slate-900 px-3 py-1">
                Equip: {equipment.slice(0, 3).join(", ")}
                {equipment.length > 3 ? " +" : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <ActionTile
            href="/wizard"
            label="Start"
            description="Spin up a new program run."
            icon={Play}
            accent="bg-brand-500/20 text-brand-100"
            footnote="Use your saved preferences"
          />
          <ActionTile
            href="/train"
            label="Continue"
            description={continueDescription}
            footnote={continueFootnote}
            icon={Timer}
            accent="bg-emerald-500/20 text-emerald-100"
            disabled={!runSummary.hasProgram}
          />
          <ActionTile
            href="/kpi"
            label="Stats"
            description="Completion, tonnage, trends."
            icon={BarChart2}
            accent="bg-sky-500/20 text-sky-100"
          />
          <ActionTile
            href="/settings"
            label="Settings"
            description="Notifications, restart, push."
            icon={Cog}
            accent="bg-amber-500/20 text-amber-100"
          />
        </div>
      </Card>

      <CurrentRunCard summary={runSummary} />
    </div>
  );
}
