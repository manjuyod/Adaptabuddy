"use client";

import type { SessionCache, SyncEvent } from "./types";

const DB_NAME = "adaptabuddy-offline";
const DB_VERSION = 1;
const EVENT_STORE = "events";
const SESSION_STORE = "session";
const PROGRAM_STORE = "program";

const memoryEvents: SyncEvent[] = [];

const isBrowser = () => typeof window !== "undefined";
const hasIndexedDb = () => typeof indexedDB !== "undefined";

const openDb = async (): Promise<IDBDatabase | null> => {
  if (!isBrowser() || !hasIndexedDb()) return null;

  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENT_STORE)) {
        const events = db.createObjectStore(EVENT_STORE, {
          keyPath: "local_seq",
          autoIncrement: true
        });
        events.createIndex("by_seq", "local_seq", { unique: true });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(PROGRAM_STORE)) {
        db.createObjectStore(PROGRAM_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
};

export const readCachedSession = async (): Promise<SessionCache | null> => {
  const db = await openDb();
  if (!db) return null;

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readonly");
    const store = tx.objectStore(SESSION_STORE);
    const request = store.get("current");

    request.onsuccess = () => resolve((request.result as SessionCache | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read cache"));
  });
};

export const persistSession = async (cache: SessionCache) => {
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    const store = tx.objectStore(SESSION_STORE);
    const request = store.put({ ...cache, key: "current" });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to write cache"));
  });
};

export const persistActiveProgram = async (value: Record<string, unknown> | null) => {
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROGRAM_STORE, "readwrite");
    const store = tx.objectStore(PROGRAM_STORE);
    const request = store.put({ key: "active_program", value, cachedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to cache program"));
  });
};

export const readActiveProgram = async (): Promise<Record<string, unknown> | null> => {
  const db = await openDb();
  if (!db) return null;

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRAM_STORE, "readonly");
    const store = tx.objectStore(PROGRAM_STORE);
    const request = store.get("active_program");
    request.onsuccess = () => {
      const result = request.result as { value?: Record<string, unknown> } | undefined;
      resolve(result?.value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read program cache"));
  });
};

export const appendEvent = async (event: SyncEvent): Promise<SyncEvent> => {
  const db = await openDb();
  if (!db) {
    const seq = memoryEvents.length + 1;
    const entry = { ...event, local_seq: seq };
    memoryEvents.push(entry);
    return entry;
  }

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(EVENT_STORE, "readwrite");
    const store = tx.objectStore(EVENT_STORE);
    const request = store.add(event);
    request.onsuccess = () => {
      const local_seq = request.result as number;
      resolve({ ...event, local_seq });
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to enqueue event"));
  });
};

export const loadEvents = async (): Promise<SyncEvent[]> => {
  const db = await openDb();
  if (!db) return [...memoryEvents];

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(EVENT_STORE, "readonly");
    const store = tx.objectStore(EVENT_STORE);
    const index = store.index("by_seq");
    const events: SyncEvent[] = [];
    const cursorRequest = index.openCursor();

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        const value = cursor.value as SyncEvent;
        const local_seq = cursor.primaryKey as number;
        events.push({ ...value, local_seq });
        cursor.continue();
      } else {
        resolve(events);
      }
    };
    cursorRequest.onerror = () =>
      reject(cursorRequest.error ?? new Error("Failed to read event queue"));
  });
};

export const clearEventsThrough = async (maxSeq: number) => {
  const db = await openDb();
  if (!db) {
    const remaining = memoryEvents.filter(
      (event) => typeof event.local_seq === "number" && event.local_seq > maxSeq
    );
    memoryEvents.splice(0, memoryEvents.length, ...remaining);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EVENT_STORE, "readwrite");
    const store = tx.objectStore(EVENT_STORE);
    const index = store.index("by_seq");
    const range = IDBKeyRange.upperBound(maxSeq);
    const cursorRequest = index.openCursor(range);

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () =>
      reject(cursorRequest.error ?? new Error("Failed to clear events"));
  });
};
