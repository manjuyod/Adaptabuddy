import type { SupabaseClientType } from "@/lib/supabase/server";
import { extractNotificationPreferences } from "./preferences";
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationType
} from "./types";

type SessionRow = {
  id: number;
  session_date: string;
  status: string | null;
  reschedule_flag: boolean | null;
  inconsistency_score: number | null;
  notes: string | null;
  program_session_key: string;
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const buildId = (type: NotificationType, ref: string | number) => `${type}:${ref}`;

const withMidday = (isoDate: string) => `${isoDate}T12:00:00.000Z`;

const computeDayDiff = (targetIso: string, now: Date) => {
  const target = new Date(`${targetIso}T00:00:00Z`);
  const utcTarget = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((utcTarget - utcNow) / (1000 * 60 * 60 * 24));
};

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const loadNotifications = async (params: {
  supabase: SupabaseClientType;
  userId: string;
  preferences: Record<string, unknown> | null | undefined;
}): Promise<{ notifications: NotificationItem[]; preferences: NotificationPreferences }> => {
  const now = new Date();
  const todayIso = toIsoDate(now);
  const lookback = new Date(now);
  lookback.setUTCDate(now.getUTCDate() - 14);
  const lookahead = new Date(now);
  lookahead.setUTCDate(now.getUTCDate() + 7);

  const prefs = extractNotificationPreferences(params.preferences);

  const { data: sessions } = await params.supabase
    .from("training_sessions")
    .select(
      "id, session_date, status, reschedule_flag, inconsistency_score, notes, program_session_key"
    )
    .eq("user_id", params.userId)
    .gte("session_date", toIsoDate(lookback))
    .lte("session_date", toIsoDate(lookahead))
    .order("session_date", { ascending: true });

  const validSessions = (sessions ?? []).filter(
    (session): session is SessionRow =>
      isNumber(session.id) &&
      typeof session.session_date === "string" &&
      typeof session.program_session_key === "string"
  );

  const upcoming = validSessions.find(
    (session) =>
      session.session_date >= todayIso &&
      (session.status === null || session.status === "planned")
  );

  const notifications: NotificationItem[] = [];

  if (upcoming) {
    const dayDiff = computeDayDiff(upcoming.session_date, now);
    if (prefs.reminders_24h && dayDiff === 1) {
      notifications.push({
        id: buildId("session_reminder_24h", upcoming.session_date),
        type: "session_reminder_24h",
        title: "Session in 24 hours",
        message: `You have a planned session tomorrow (${upcoming.session_date}). Prep your gear and recovery.`,
        created_at: withMidday(todayIso),
        level: "info",
        actions: [{ label: "View session", href: "/train" }]
      });
    }
    if (prefs.reminders_2h && dayDiff === 0) {
      notifications.push({
        id: buildId("session_reminder_2h", upcoming.session_date),
        type: "session_reminder_2h",
        title: "Session today",
        message:
          "Your next session is scheduled for today. Aim to start within the next couple hours.",
        created_at: withMidday(todayIso),
        level: "info",
        actions: [{ label: "Open training", href: "/train" }]
      });
    }
  }

  const missed = validSessions.filter(
    (session) =>
      session.session_date < todayIso &&
      (session.status === null || session.status === "planned" || session.status === "missed")
  );

  if (prefs.missed_session && missed.length > 0) {
    notifications.push({
      id: buildId("missed_session", missed[0]?.session_date ?? todayIso),
      type: "missed_session",
      title: "You have unfinished sessions",
      message:
        missed.length === 1
          ? "You missed your last planned session. Consider rescheduling or logging it."
          : `You missed ${missed.length} recent sessions. Reschedule or restart to stay on track.`,
      created_at: withMidday(todayIso),
      level: missed.length > 1 ? "warning" : "info",
      actions: [{ label: "Run reschedule", href: "/settings" }]
    });
  }

  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - 7);
  const missedThisWeek = missed.filter((session) => session.session_date >= toIsoDate(weekStart));
  const rescheduleFlags = validSessions.filter(
    (session) => session.reschedule_flag === true && session.session_date >= todayIso
  );

  if (prefs.reschedule_recommendation && (missedThisWeek.length >= 2 || rescheduleFlags.length > 0)) {
    const reason =
      missedThisWeek.length >= 2
        ? `${missedThisWeek.length} misses in the last week`
        : "Auto-reschedule flagged upcoming sessions";
    notifications.push({
      id: buildId("reschedule_recommendation", reason),
      type: "reschedule_recommendation",
      title: "Reschedule recommended",
      message: `${reason}. A soft restart or reshuffle can realign your plan.`,
      created_at: withMidday(todayIso),
      level: "warning",
      actions: [
        { label: "Open training", href: "/train" },
        { label: "Restart/reschedule", href: "/settings" }
      ]
    });
  }

  if (prefs.pain_trend) {
    const recentSessionIds = validSessions
      .filter((session) => session.session_date <= todayIso)
      .map((session) => session.id);

    const { data: painRows } = await params.supabase
      .from("training_exercises")
      .select("session_id, pain_score")
      .in("session_id", recentSessionIds.length > 0 ? recentSessionIds : [-1])
      .not("pain_score", "is", null);

    const sessionLookup = new Map<number, string>();
    validSessions.forEach((session) => {
      sessionLookup.set(session.id, session.session_date);
    });

    const painSeries =
      painRows
        ?.map((row) => {
          if (!isNumber(row.session_id) || !isNumber(row.pain_score)) return null;
          const date = sessionLookup.get(row.session_id);
          if (!date) return null;
          return { date, pain: row.pain_score };
        })
        .filter((entry): entry is { date: string; pain: number } => Boolean(entry)) ?? [];

    painSeries.sort((a, b) => a.date.localeCompare(b.date));

    const recentPain = painSeries.slice(-6);
    if (recentPain.length >= 3) {
      const latestWindow = recentPain.slice(-3).map((entry) => (entry as { pain: number }).pain);
      const prevWindow =
        recentPain.length >= 6
          ? recentPain.slice(-6, -3).map((entry) => (entry as { pain: number }).pain)
          : [];
      const latestAvg = average(latestWindow);
      const prevAvg = prevWindow.length > 0 ? average(prevWindow) : 0;
      const rising = prevWindow.length > 0 ? latestAvg - prevAvg >= 1.5 : false;
      const highPain = latestAvg >= 6;
      if (rising || highPain) {
        notifications.push({
          id: buildId("pain_trend", recentPain[recentPain.length - 1]?.date ?? todayIso),
          type: "pain_trend",
          title: "Pain trend warning",
          message: highPain
            ? "Recent pain scores are high. Consider reducing load and reviewing contraindications."
            : "Pain is trending up. Adjust intensity or exercise selection before it spikes.",
          created_at: withMidday(todayIso),
          level: highPain ? "critical" : "warning",
          actions: [{ label: "Review session", href: "/train" }]
        });
      }
    }
  }

  return { notifications, preferences: prefs };
};
