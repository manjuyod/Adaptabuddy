"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { LogIn, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message
      });
      return;
    }

    toast({
      title: "Signed in",
      description: "Session secured with HttpOnly cookies."
    });
    router.push("/train");
  };

  const handleOAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/api/auth/callback`
      }
    });

    if (error) {
      toast({ title: "OAuth failed", description: error.message });
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

        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Email
          </label>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Password
          </label>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
          <Button
            className="mt-2 w-full"
            onClick={handleLogin}
            disabled={loading}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleOAuth}
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
