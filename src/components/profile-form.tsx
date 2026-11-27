"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/http";

function Message({ tone, text }: { tone: "error" | "ok"; text: string }) {
  return tone === "error"
    ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{text}</p>
    : <p role="status" className="rounded-md border border-[#C6DCD0] bg-[#F3F8F4] px-3 py-2 text-sm text-[#315C43]">{text}</p>;
}

export function ProfileForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [name, setName] = React.useState(user.name);
  const [nameState, setNameState] = React.useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [savingName, setSavingName] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pwState, setPwState] = React.useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [savingPw, setSavingPw] = React.useState(false);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (savingName) return;
    setSavingName(true); setNameState(null);
    try {
      await apiRequest("/api/auth/me", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      setNameState({ tone: "ok", text: "Name updated." });
      router.refresh();
    } catch (cause) {
      setNameState({ tone: "error", text: cause instanceof Error ? cause.message : "Couldn't update your name. Try again." });
    } finally { setSavingName(false); }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (savingPw) return;
    if (next !== confirm) { setPwState({ tone: "error", text: "The new passwords don't match. Re-enter them." }); return; }
    setSavingPw(true); setPwState(null);
    try {
      await apiRequest("/api/auth/me", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent(""); setNext(""); setConfirm("");
      setPwState({ tone: "ok", text: "Password changed. Other devices have been signed out." });
    } catch (cause) {
      setPwState({ tone: "error", text: cause instanceof Error ? cause.message : "Couldn't change your password. Try again." });
    } finally { setSavingPw(false); }
  }

  return (
    <main className="w-full min-w-0 px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-10">
      <div className="mb-6">
        <p className="technical-eyebrow mb-1.5">ACCOUNT / PROFILE</p>
        <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-primary sm:text-[32px]">Profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Your account details and password.</p>
      </div>
      <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
        <form onSubmit={saveName} noValidate className="space-y-4 rounded-xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold">Account</h2>
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Username</dt><dd className="mt-1 font-mono">{user.username}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Role</dt><dd className="mt-1 capitalize">{user.role}</dd></div>
          </dl>
          {nameState && <Message {...nameState} />}
          <Button type="submit" disabled={savingName || !name.trim() || name.trim() === user.name}>
            <Save /> {savingName ? "Saving..." : "Save name"}
          </Button>
        </form>
        <form onSubmit={savePassword} noValidate className="space-y-4 rounded-xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold">Change password</h2>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {pwState && <Message {...pwState} />}
          <Button type="submit" disabled={savingPw || !current || !next}>
            <KeyRound /> {savingPw ? "Changing..." : "Change password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
