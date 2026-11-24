"use client";

import * as React from "react";
import { KeyRound, Plus, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/http";

type AppUser = { id: string; username: string; name: string; role: "admin" | "user"; active: boolean; createdAt: string };

const selectClass = "h-9 w-full rounded-md border border-input bg-white px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function UserManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", username: "", password: "", role: "user" as AppUser["role"] });
  const [formError, setFormError] = React.useState("");
  const [passwordTarget, setPasswordTarget] = React.useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<AppUser | null>(null);

  React.useEffect(() => {
    apiRequest<AppUser[]>("/api/users")
      .then(setUsers)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load users."))
      .finally(() => setLoading(false));
  }, []);

  async function update(user: AppUser, data: Partial<Pick<AppUser, "role" | "active">> & { password?: string }) {
    setBusy(true); setError("");
    try {
      const updated = await apiRequest<AppUser>("/api/users/" + encodeURIComponent(user.id), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to update user.";
      if (data.password) setFormError(message); else setError(message);
      return false;
    } finally { setBusy(false); }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setFormError("");
    try {
      const user = await apiRequest<AppUser>("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      setUsers((current) => [...current, user].sort((a, b) => a.username.localeCompare(b.username)));
      setCreateOpen(false);
      setForm({ name: "", username: "", password: "", role: "user" });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to add user.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true); setFormError("");
    try {
      await apiRequest("/api/users/" + encodeURIComponent(deleteTarget.id), { method: "DELETE" });
      setUsers((current) => current.filter((entry) => entry.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to delete user.");
    } finally { setBusy(false); }
  }

  return (
    <main className="w-full min-w-0 max-w-none px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-12">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="technical-eyebrow mb-1.5">ADMINISTRATION / USERS</p>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-primary sm:text-[32px]">Users</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Manage who can sign in to the tracker.</p>
        </div>
        <Button className="h-10 w-full sm:w-auto" onClick={() => { setCreateOpen(true); setFormError(""); }}>
          <Plus /> Add User
        </Button>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <section className="min-w-0 rounded-xl border border-border bg-white">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-[#f0f5fa]">
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const self = user.id === currentUserId;
              return (
                <TableRow key={user.id} className="h-11">
                  <TableCell className="pl-4 font-medium">{user.name}{self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{user.username}</TableCell>
                  <TableCell>
                    <select aria-label={"Role for " + user.username} className={selectClass + " w-28"} value={user.role}
                      disabled={busy || self} onChange={(e) => update(user, { role: e.target.value as AppUser["role"] })}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                      (user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="Reset password" aria-label={"Reset password for " + user.username}
                        disabled={busy} onClick={() => { setPasswordTarget(user); setNewPassword(""); setFormError(""); }}>
                        <KeyRound />
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={busy || self}
                        title={user.active ? "Deactivate" : "Activate"}
                        aria-label={(user.active ? "Deactivate " : "Activate ") + user.username}
                        onClick={() => update(user, { active: !user.active })}>
                        {user.active ? <UserX /> : <UserCheck />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={busy || self} title="Delete"
                        aria-label={"Delete " + user.username}
                        onClick={() => { setDeleteTarget(user); setFormError(""); }}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(loading || users.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-14 text-center">
                  <Users className="mx-auto mb-2 size-7 text-muted-foreground" />
                  <p className="text-sm font-semibold">{loading ? "Loading users..." : "No users found"}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!busy) setCreateOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={create} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
              <DialogDescription>They sign in with this username and password.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Full name</Label>
              <Input id="new-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Username</Label>
              <Input id="new-username" autoCapitalize="none" autoComplete="off" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Role</Label>
              <select id="new-role" className={selectClass} value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppUser["role"] })}>
                <option value="user">User — schedules, reports and catalogs</option>
                <option value="admin">Admin — also manages users</option>
              </select>
            </div>
            {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Adding..." : "Add User"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordTarget} onOpenChange={(open) => { if (!open && !busy) setPasswordTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <form className="space-y-4" noValidate onSubmit={async (event) => {
            event.preventDefault();
            if (passwordTarget && await update(passwordTarget, { password: newPassword })) setPasswordTarget(null);
          }}>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                Set a new password for {passwordTarget?.username}. They will be signed out of all devices.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New password</Label>
              <Input id="reset-password" type="password" autoComplete="new-password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPasswordTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Reset Password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.username}? They can no longer sign in. Reports they submitted are kept.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={remove}>
              {busy ? "Deleting..." : "Delete " + (deleteTarget?.username ?? "")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
