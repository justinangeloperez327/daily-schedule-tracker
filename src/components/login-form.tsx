"use client";

import * as React from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/http";

export function LoginForm({ next }: { next: string }) {
  const [needsSetup, setNeedsSetup] = React.useState<boolean | null>(null);
  const [name, setName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    apiRequest<{ needsSetup: boolean }>("/api/auth/setup")
      .then((result) => setNeedsSetup(result.needsSetup))
      .catch((cause: unknown) => {
        setNeedsSetup(false);
        setError(cause instanceof Error ? cause.message : "Unable to reach the server.");
      });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (needsSetup && password !== confirm) { setError("The two passwords don't match. Re-enter them."); return; }
    setSubmitting(true); setError("");
    try {
      await apiRequest(needsSetup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsSetup ? { name, username, password } : { username, password }),
      });
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Try again.");
      setSubmitting(false);
    }
  }

  const setup = needsSetup === true;
  return (
    <main className="flex w-full justify-center px-4 py-12 sm:py-20">
      <section className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-[0_2px_16px_rgba(16,24,40,0.04)] sm:p-8">
        <p className="technical-eyebrow mb-1.5">{setup ? "FIRST-TIME SETUP" : "SECURE ACCESS"}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {setup ? "Create administrator" : "Sign in"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {setup
            ? "No accounts exist yet. This first account can add other users."
            : "Use the account your administrator gave you."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {setup && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" autoCapitalize="none" value={username}
              onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={setup ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} required />
            {setup && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
          </div>
          {setup && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          )}
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-10 w-full" disabled={submitting || needsSetup === null}>
            {setup ? <ShieldCheck /> : <LogIn />}
            {submitting ? (setup ? "Creating account..." : "Signing in...") : setup ? "Create administrator" : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
