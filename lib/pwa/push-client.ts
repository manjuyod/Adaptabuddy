"use client";

const getEnv = (name: string) => (typeof process !== "undefined" ? process.env[name] : undefined);

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const vapidKey = (getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") ?? "").trim();

export const hasPushSupport = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const currentPermission = (): NotificationPermission | "unsupported" => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
};

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  if (!hasPushSupport()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

export const requestPushSubscription = async (): Promise<PushSubscription> => {
  if (!hasPushSupport()) {
    throw new Error("Push API not supported in this browser.");
  }

  if (!vapidKey) {
    throw new Error("Missing VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications permission was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  const applicationKey = urlBase64ToUint8Array(vapidKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationKey.buffer as ArrayBuffer
  });
  return subscription;
};

export const unsubscribePush = async (): Promise<boolean> => {
  const existing = await getExistingSubscription();
  if (!existing) return true;
  return existing.unsubscribe();
};

export const getVapidKey = () => vapidKey;
