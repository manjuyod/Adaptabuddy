"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { resolveNextPath } from "@/lib/auth/redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { LogIn, Shield } from "lucide-react";

type AuthMode = "signin" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  const nextParam = searchParams.get("next");
  const safeNextPath = resolveNextPath(nextParam);

  const completeServerRedirect = async () => {
    const response = await fetch("/auth/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next: safeNextPath })
    });

    if (!response.ok) {
      toast({
        title: "Could not finish signing in",
        description: "Please try again."
      });
      return;
    }

    const body = (await response.json()) as { redirectPath?: string };
    const destination = (body.redirectPath ?? "/home") as Route;
    router.replace(destination);
    router.refresh();
  };

  const handleEmailAuth = async () => {
    setLoading(true);
    const { error, data } =
      authMode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast({
        title: authMode === "signup" ? "Sign up failed" : "Login failed",
        description: error.message
      });
      return;
    }

    if (!data.session) {
      setLoading(false);
      toast({
        title: "Check your email",
        description: "Confirm your sign-up to continue."
      });
      return;
    }

    await completeServerRedirect();
    setLoading(false);
  };

  const handleOAuth = async () => {
    setLoading(true);
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    if (safeNextPath) {
      redirectUrl.searchParams.set("next", safeNextPath);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl.toString()
      }
    });

    if (error) {
      toast({ title: "OAuth failed", description: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 py-10">
      <Card className="w-full space-y-6 border border-slate-800/70 bg-slate-900/60 p-6">
        <div className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-100">
            <Shield />
          </div>
          <h1 className="text-2xl font-semibold text-white">Adaptabuddy</h1>
          <p className="text-sm text-slate-400">
            Login is secured via Supabase session cookies. Works with SSR.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-800/80 p-1 text-sm text-slate-200">
          <Button
            type="button"
            variant={authMode === "signin" ? "primary" : "ghost"}
            className="flex-1"
            onClick={() => setAuthMode("signin")}
            disabled={loading}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={authMode === "signup" ? "primary" : "ghost"}
            className="flex-1"
            onClick={() => setAuthMode("signup")}
            disabled={loading}
          >
            Create account
          </Button>
        </div>

        <div className="space-y-3">
          <label
            className="text-xs uppercase tracking-wide text-slate-400"
            htmlFor="email"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <label
            className="text-xs uppercase tracking-wide text-slate-400"
            htmlFor="password"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
          <Button
            className="mt-2 w-full"
            onClick={() => void handleEmailAuth()}
            disabled={loading}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {loading
              ? authMode === "signup"
                ? "Creating..."
                : "Signing in..."
              : authMode === "signup"
                ? "Create account"
                : "Sign in"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void handleOAuth()}
            disabled={loading}
          >
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-xs text-slate-500">
          We store tokens in secure HttpOnly cookies and refresh via middleware
          to keep SSR pages in sync.
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Loading login...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
