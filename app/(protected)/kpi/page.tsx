import { Activity, BarChart2, BarChart3, Flame, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import type { KpiResponse } from "@/lib/kpi/types";

type LinePoint = { label: string; value: number };
type Series = { name: string; color: string; points: LinePoint[] };

const buildApiUrl = () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    return base ? `${base}/api/kpi` : "/api/kpi";
  }
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is required for server-side KPI fetches. Set it to your deployed site origin."
    );
  }
  return `${base}/api/kpi`;
};

const shortLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${month}/${day}`;
};

const toPercent = (fraction: number) => Math.round(fraction * 1000) / 10;
const formatPercent = (fraction: number) => `${toPercent(fraction)}%`;

const formatNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
};

const fetchKpi = async (): Promise<KpiResponse | null> => {
  try {
    const response = await fetch(buildApiUrl(), { cache: "no-store" });
    if (!response.ok) return null;
    const raw = await response.text();
    try {
      return JSON.parse(raw) as KpiResponse;
    } catch (error) {
      console.error("Failed to parse KPI response", { error, body: raw });
      return null;
    }
  } catch (error) {
    console.error("KPI fetch failed", error);
    return null;
  }
};

const Sparkline = ({
  points,
  color,
  height = 80
}: {
  points: LinePoint[];
  color: string;
  height?: number;
}) => {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const width = 260;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => ({
    x: index * step,
    y: height - (point.value / max) * height
  }));
  const path = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" className="w-full">
      <path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
      {coords.map((coord, index) => (
        <circle
          key={`${coord.x}-${coord.y}-${index}`}
          cx={coord.x}
          cy={coord.y}
          r={3}
          fill={color}
          opacity={0.9}
        />
      ))}
    </svg>
  );
};

const MultiLineChart = ({ series, height = 140 }: { series: Series[]; height?: number }) => {
  if (series.length === 0) return null;
  const max = Math.max(
    ...series.flatMap((line) => line.points.map((point) => point.value)),
    1
  );
  const width = 320;
  const pointCount = series[0]?.points.length ?? 0;
  const step = pointCount > 1 ? width / (pointCount - 1) : width;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true" className="w-full">
      <g>
        {series.map((line) => {
          const coords = line.points.map((point, index) => ({
            x: index * step,
            y: height - (point.value / max) * height
          }));
          const path = coords
            .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`)
            .join(" ");
          return (
            <g key={line.name}>
              <path
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={3}
                strokeLinecap="round"
              />
              {coords.map((coord, index) => (
                <circle
                  key={`${line.name}-${index}`}
                  cx={coord.x}
                  cy={coord.y}
                  r={3}
                  fill={line.color}
                  opacity={0.9}
                />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default async function KpiPage() {
  const data = await fetchKpi();

  if (!data) {
    return (
      <Card className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-slate-200">
          <Activity size={18} className="text-amber-300" />
          <p className="text-sm font-semibold">KPI dashboard</p>
        </div>
        <p className="text-sm text-slate-400">
          Unable to load metrics right now. Check your connection or sync again.
        </p>
      </Card>
    );
  }

  const weekOrder = data.completion.weeks.map((week) => week.week_start);
  const completionSeries: LinePoint[] = data.completion.weeks.map((week) => ({
    label: shortLabel(week.week_start),
    value: toPercent(week.rate)
  }));
  const latestCompletionRate = data.completion.weeks.at(-1)?.rate ?? 0;

  const patternLookup = new Map<string, Map<string, number>>();
  data.tonnage_by_pattern.forEach((entry) => {
    const weekMap = patternLookup.get(entry.week_start) ?? new Map<string, number>();
    weekMap.set(entry.pattern, entry.tonnage);
    patternLookup.set(entry.week_start, weekMap);
  });

  const patternSeries: Series[] = ["push", "pull", "squat", "hinge", "carry", "core"].map(
    (pattern, index) => ({
      name: pattern,
      color: ["#38bdf8", "#f472b6", "#22c55e", "#f97316", "#eab308", "#a855f7"][index],
      points: weekOrder.map((week) => ({
        label: shortLabel(week),
        value: patternLookup.get(week)?.get(pattern) ?? 0
      }))
    })
  );

  const muscleLookup = new Map<string, { name: string; tonnage: number }[]>();
  data.tonnage_by_muscle.forEach((entry) => {
    const list = muscleLookup.get(entry.week_start) ?? [];
    list.push({ name: entry.muscle_group, tonnage: entry.tonnage });
    muscleLookup.set(entry.week_start, list);
  });
  const latestWeek = weekOrder.at(-1);
  const topMuscles =
    latestWeek && muscleLookup.has(latestWeek)
      ? (muscleLookup.get(latestWeek) ?? []).sort((a, b) => b.tonnage - a.tonnage).slice(0, 5)
      : [];
  const topMuscleMax = Math.max(...topMuscles.map((muscle) => muscle.tonnage), 1);

  const e1rmSeries: Series[] = [
    {
      name: "Squat",
      color: "#22c55e",
      points: data.e1rm.squat.map((point) => ({
        label: shortLabel(point.week_start),
        value: point.e1rm
      }))
    },
    {
      name: "Bench",
      color: "#38bdf8",
      points: data.e1rm.bench.map((point) => ({
        label: shortLabel(point.week_start),
        value: point.e1rm
      }))
    },
    {
      name: "Deadlift",
      color: "#f97316",
      points: data.e1rm.deadlift.map((point) => ({
        label: shortLabel(point.week_start),
        value: point.e1rm
      }))
    }
  ];

  const dotsLabel =
    data.dots.status === "ok" && data.dots.score !== null
      ? data.dots.score.toFixed(0)
      : "Needs data";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Performance</p>
          <h2 className="text-lg font-semibold text-white">Signals & KPIs</h2>
        </div>
        <Chip variant="default">Last 8 weeks</Chip>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Completion rate</p>
          <p className="text-2xl font-semibold text-white">
            {formatPercent(latestCompletionRate)}
          </p>
          <p className="text-xs text-slate-400">Weekly average across planned sessions</p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Current streak</p>
          <p className="text-2xl font-semibold text-white">{data.completion.current_streak}</p>
          <p className="text-xs text-slate-400">Longest {data.completion.longest_streak}</p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">DOTS total</p>
          <p className="text-2xl font-semibold text-white">{dotsLabel}</p>
          <p className="text-xs text-slate-400">
            {data.dots.total ? `S/B/D: ${Math.round(data.dots.total)}` : "Add bodyweight + totals"}
          </p>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between text-slate-200">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-brand-200" />
              <span className="text-sm font-semibold">Weekly completion</span>
            </div>
            <Chip variant="success">{formatPercent(latestCompletionRate)} latest</Chip>
          </div>
          <Sparkline points={completionSeries} color="#22c55e" height={90} />
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
            {data.completion.weeks.map((week) => (
              <div key={week.week_start} className="rounded-lg bg-slate-900/70 p-2">
                <p className="font-semibold text-white">{formatPercent(week.rate)}</p>
              <p className="text-slate-400">{shortLabel(week.week_start)}</p>
              <p className="text-slate-500">
                {week.completed}/{week.total} sessions
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-amber-300" />
            <span className="text-sm font-semibold">Tonnage by movement</span>
          </div>
          <Chip variant="default">Patterns</Chip>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {patternSeries.map((series) => (
            <div key={series.name} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span className="capitalize">{series.name}</span>
                <span className="text-slate-400">
                  {formatNumber(series.points.at(-1)?.value ?? 0)}
                </span>
              </div>
              <Sparkline points={series.points} color={series.color} height={70} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-brand-200" />
            <span className="text-sm font-semibold">Muscle group load</span>
          </div>
          <Chip variant="default">Top groups (latest week)</Chip>
        </div>
        {topMuscles.length === 0 ? (
          <p className="text-sm text-slate-400">No logged volume yet.</p>
        ) : (
          <div className="space-y-2">
            {topMuscles.map((muscle) => (
              <div key={muscle.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>{muscle.name}</span>
                  <span className="text-slate-400">{formatNumber(muscle.tonnage)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-brand-400"
                    style={{
                      width: `${Math.min(100, (muscle.tonnage / topMuscleMax) * 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-300" />
            <span className="text-sm font-semibold">e1RM trend</span>
          </div>
          <div className="flex gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Squat
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> Bench
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-400" /> Deadlift
            </span>
          </div>
        </div>
        <MultiLineChart series={e1rmSeries} height={140} />
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          {["Squat", "Bench", "Deadlift"].map((lift, index) => {
            const latest =
              index === 0
                ? data.e1rm.squat.at(-1)?.e1rm ?? 0
                : index === 1
                  ? data.e1rm.bench.at(-1)?.e1rm ?? 0
                  : data.e1rm.deadlift.at(-1)?.e1rm ?? 0;
            return (
              <div
                key={lift}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-center"
              >
                <p className="text-sm font-semibold text-white">{lift}</p>
                <p className="text-lg font-semibold text-white">{latest > 0 ? latest : "-"}</p>
                <p className="text-slate-500">Best set per week</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-slate-200">
          <Activity size={18} className="text-amber-300" />
          <span className="text-sm font-semibold">Fatigue flags</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-900/70 p-3">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>Volume spike</span>
              <Chip variant={data.fatigue.volume_spike ? "warning" : "success"}>
                {data.fatigue.volume_spike ? "Flag" : "Normal"}
              </Chip>
            </div>
            <p className="text-xs text-slate-400">
              {data.fatigue.volume_change !== null
                ? `${data.fatigue.volume_change.toFixed(1)}% vs prior 4wk`
                : "Need more sets"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/70 p-3">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>RPE trend</span>
              <Chip variant={data.fatigue.rpe_rising ? "warning" : "success"}>
                {data.fatigue.rpe_rising ? "Rising" : "Stable"}
              </Chip>
            </div>
            <p className="text-xs text-slate-400">
              {data.fatigue.rpe_change !== null
                ? `${data.fatigue.rpe_change.toFixed(1)} Δ while volume steady`
                : "No RPE entries yet"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/70 p-3">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>Pain trend</span>
              <Chip variant={data.fatigue.pain_rising ? "warning" : "success"}>
                {data.fatigue.pain_rising ? "Rising" : "Stable"}
              </Chip>
            </div>
            <p className="text-xs text-slate-400">
              {data.fatigue.pain_delta !== null
                ? `${data.fatigue.pain_delta.toFixed(1)} change vs prior 2wk`
                : "No pain scores yet"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
