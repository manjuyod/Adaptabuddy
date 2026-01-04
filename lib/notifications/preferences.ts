import {
  defaultNotificationPreferences,
  type NotificationPreferences
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const extractNotificationPreferences = (
  preferences: Record<string, unknown> | null | undefined
): NotificationPreferences => {
  const rawSettings: Record<string, unknown> =
    isRecord(preferences) && isRecord(preferences.notification_settings)
      ? preferences.notification_settings
      : {};

  return {
    reminders_24h: asBoolean(rawSettings.reminders_24h, defaultNotificationPreferences.reminders_24h),
    reminders_2h: asBoolean(rawSettings.reminders_2h, defaultNotificationPreferences.reminders_2h),
    missed_session: asBoolean(rawSettings.missed_session, defaultNotificationPreferences.missed_session),
    reschedule_recommendation: asBoolean(
      rawSettings.reschedule_recommendation,
      defaultNotificationPreferences.reschedule_recommendation
    ),
    pain_trend: asBoolean(rawSettings.pain_trend, defaultNotificationPreferences.pain_trend),
    push_opt_in: asBoolean(rawSettings.push_opt_in, defaultNotificationPreferences.push_opt_in)
  };
};

export const mergeNotificationPreferences = (
  preferences: Record<string, unknown> | null | undefined,
  updates: Partial<NotificationPreferences>
): Record<string, unknown> => {
  const base = extractNotificationPreferences(preferences ?? {});
  return {
    ...(isRecord(preferences) ? preferences : {}),
    notification_settings: {
      ...base,
      ...updates
    }
  };
};
