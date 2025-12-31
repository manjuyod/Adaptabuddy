"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
