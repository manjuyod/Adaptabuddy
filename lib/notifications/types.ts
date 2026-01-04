export type NotificationType =
  | "session_reminder_24h"
  | "session_reminder_2h"
  | "missed_session"
  | "reschedule_recommendation"
  | "pain_trend";

export type NotificationLevel = "info" | "warning" | "critical";

export type NotificationAction = {
  label: string;
  href: string;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  level: NotificationLevel;
  actions?: NotificationAction[];
};

export type NotificationPreferences = {
  reminders_24h: boolean;
  reminders_2h: boolean;
  missed_session: boolean;
  reschedule_recommendation: boolean;
  pain_trend: boolean;
  push_opt_in: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  reminders_24h: true,
  reminders_2h: true,
  missed_session: true,
  reschedule_recommendation: true,
  pain_trend: true,
  push_opt_in: false
};
