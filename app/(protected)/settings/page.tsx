"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast-provider";
import {
  defaultNotificationPreferences,
  type NotificationPreferences
} from "@/lib/notifications/types";
import {
  currentPermission,
  getExistingSubscription,
  getVapidKey,
  hasPushSupport,
  requestPushSubscription,
  unsubscribePush
} from "@/lib/pwa/push-client";
import type { RescheduleResponse } from "@/lib/train/types";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  WifiOff,
  Zap
} from "lucide-react";

type PushStatus = "idle" | "subscribed" | "unsubscribed" | "error";

export default function SettingsPage() {
  const { toast } = useToast();
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    defaultNotificationPreferences
  );
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    currentPermission()
  );
  const [isRestarting, setIsRestarting] = useState<null | "auto" | "soft" | "hard">(null);
  const [reshuffleSeed, setReshuffleSeed] = useState(false);
  const vapidKey = getVapidKey();

  const loadPreferences = useCallback(async () => {
    setLoadingPrefs(true);
    try {
      const response = await fetch("/api/notifications/preferences", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load preferences");
      }
      const payload = (await response.json()) as { preferences?: NotificationPreferences };
      if (payload.preferences) {
        setNotificationPrefs(payload.preferences);
      }
    } catch (error) {
      toast({
        title: "Failed to load",
        description: error instanceof Error ? error.message : "Could not load preferences."
      });
    } finally {
      setLoadingPrefs(false);
    }
  }, [toast]);

  const syncPushStatus = useCallback(async () => {
    if (!hasPushSupport()) {
      setPushStatus("error");
      setPushMessage("Push API is not supported in this browser.");
      return;
    }
    const existing = await getExistingSubscription();
    setPushStatus(existing ? "subscribed" : "unsubscribed");
  }, []);

  useEffect(() => {
    void loadPreferences();
    void syncPushStatus();
    setPermission(currentPermission());
  }, [loadPreferences, syncPushStatus]);

  const savePreferences = useCallback(async () => {
    setSavingPrefs(true);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPrefs)
      });
      const payload = (await response.json()) as { preferences?: NotificationPreferences; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save preferences");
      }
      if (payload.preferences) {
        setNotificationPrefs(payload.preferences);
      }
      toast({ title: "Notification preferences saved" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save preferences."
      });
    } finally {
      setSavingPrefs(false);
    }
  }, [notificationPrefs, toast]);

  const enablePush = useCallback(async () => {
    setPushLoading(true);
    setPushMessage(null);
    try {
      const subscription = await requestPushSubscription();
      const body =
        typeof subscription.toJSON === "function" ? subscription.toJSON() : (subscription as unknown);
      const pushResponse = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!pushResponse.ok) {
        throw new Error("Failed to persist subscription");
      }

      const prefResponse = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_opt_in: true })
      });
      const prefText = await prefResponse.text();
      let prefPayload: { preferences?: NotificationPreferences; error?: string } | null = null;
      try {
        prefPayload = JSON.parse(prefText) as { preferences?: NotificationPreferences; error?: string };
      } catch {
        // no-op; will fall back to prefText for error messaging
      }
      if (!prefResponse.ok) {
        const rollback = await fetch("/api/push", { method: "DELETE" });
        if (!rollback.ok) {
          console.error("Failed to roll back push subscription after preference error", {
            status: rollback.status
          });
        }
        throw new Error(prefPayload?.error ?? prefText ?? "Failed to save push preference");
      }

      if (prefPayload?.preferences) {
        setNotificationPrefs(prefPayload.preferences);
      } else {
        setNotificationPrefs((prev) => ({ ...prev, push_opt_in: true }));
      }
      setPushStatus("subscribed");
      toast({ title: "Push enabled", description: "Web push subscription saved." });
    } catch (error) {
      setPushStatus("error");
      setPushMessage(error instanceof Error ? error.message : "Push setup failed.");
      toast({
        title: "Push failed",
        description: error instanceof Error ? error.message : "Unable to enable push."
      });
    } finally {
      setPushLoading(false);
      setPermission(currentPermission());
    }
  }, [toast]);

  const disablePush = useCallback(async () => {
    setPushLoading(true);
    setPushMessage(null);
    try {
      const unsubscribed = await unsubscribePush();
      if (!unsubscribed) {
        throw new Error("Unable to remove browser push subscription.");
      }

      const deleteResponse = await fetch("/api/push", { method: "DELETE" });
      if (!deleteResponse.ok) {
        const message = await deleteResponse.text();
        throw new Error(message || "Failed to remove push subscription.");
      }

      const prefResponse = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_opt_in: false })
      });
      const prefText = await prefResponse.text();
      let prefPayload: { preferences?: NotificationPreferences; error?: string } | null = null;
      try {
        prefPayload = JSON.parse(prefText) as { preferences?: NotificationPreferences; error?: string };
      } catch {
        // fall through to error handling below
      }
      if (!prefResponse.ok) {
        throw new Error(prefPayload?.error ?? prefText ?? "Failed to update push preference.");
      }

      if (prefPayload?.preferences) {
        setNotificationPrefs(prefPayload.preferences);
      } else {
        setNotificationPrefs((prev) => ({ ...prev, push_opt_in: false }));
      }
      setPushStatus("unsubscribed");
      toast({ title: "Push disabled", description: "Subscription removed." });
    } catch (error) {
      setPushStatus("error");
      setPushMessage(error instanceof Error ? error.message : "Could not disable push.");
      toast({
        title: "Unsubscribe failed",
        description: error instanceof Error ? error.message : "Unable to remove subscription."
      });
    } finally {
      setPushLoading(false);
      setPermission(currentPermission());
    }
  }, [toast]);

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

  const pushStatusCopy: Record<PushStatus, { label: string; tone: "default" | "success" | "warning" }> =
    {
      idle: { label: "Checking", tone: "default" },
      subscribed: { label: "Subscribed", tone: "success" },
      unsubscribed: { label: "Not subscribed", tone: "default" },
      error: { label: "Attention needed", tone: "warning" }
    };

  const prefToggles: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    { key: "reminders_24h", label: "24h reminder", description: "Heads up the day before a planned session." },
    { key: "reminders_2h", label: "Day-of reminder", description: "Nudge to start within the next couple hours." },
    { key: "missed_session", label: "Missed session warning", description: "Flag unfinished sessions so you can reschedule." },
    { key: "reschedule_recommendation", label: "Restart suggestion", description: "Suggest soft/hard restart after repeated misses." },
    { key: "pain_trend", label: "Pain trend alert", description: "Warn when pain scores trend upward across sessions." }
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-white">Settings</h2>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Notification preferences</p>
            <p className="text-sm text-slate-400">
              Control in-app reminders for sessions and recovery.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => void savePreferences()}
            disabled={savingPrefs || loadingPrefs}
          >
            {savingPrefs ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            Save
          </Button>
        </div>
        {loadingPrefs ? (
          <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-300">
            <Loader2 size={16} className="animate-spin text-brand-100" />
            Loading preferences...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {prefToggles.map((pref) => (
              <div
                key={pref.key}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{pref.label}</p>
                  <p className="text-xs text-slate-400">{pref.description}</p>
                </div>
                <Toggle
                  checked={notificationPrefs[pref.key]}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs((prev) => ({ ...prev, [pref.key]: checked }))
                  }
                  aria-label={pref.label}
                />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">
          These controls drive the in-app notification center and future push nudges.
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Web push (scaffolding)</p>
            <p className="text-sm text-slate-400">
              Subscribe to browser push for session reminders. Delivery will be wired later.
            </p>
          </div>
          <Chip variant={pushStatusCopy[pushStatus].tone}>
            {pushStatusCopy[pushStatus].label}
          </Chip>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full bg-slate-900 px-3 py-1">
            Permission: {permission}
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1">
            VAPID key: {vapidKey ? "set" : "missing"}
          </span>
        </div>
        {pushMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <AlertTriangle size={14} />
            <span>{pushMessage}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void enablePush()}
            disabled={pushLoading || pushStatus === "subscribed"}
          >
            {pushLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Zap size={16} className="mr-2" />}
            Subscribe
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void disablePush()}
            disabled={pushLoading || pushStatus === "unsubscribed"}
          >
            {pushLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
            Unsubscribe
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-200"
            onClick={() => void syncPushStatus()}
            disabled={pushLoading}
          >
            Check status
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Requires service worker registration and notification permission in your browser.
        </p>
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <WifiOff size={18} className="text-amber-300" />
          <p className="text-sm font-semibold">Offline-first logging</p>
        </div>
        <p className="text-sm text-slate-300">
          Sessions stay writable offline. Actions queue to IndexedDB and flush through /api/sync when
          you regain connectivity.
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-slate-200">
          <ShieldCheck size={18} className="text-emerald-400" />
          <p className="text-sm font-semibold">Security</p>
        </div>
        <p className="text-sm text-slate-300">
          Sessions rely on Supabase secure cookies. Tokens refresh via middleware for SSR routes.
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
