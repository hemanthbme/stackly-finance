import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_EMAIL = "admin@stackly.app"; /* REPLACE WITH YOUR EMAIL */

type Row = {
  user_id: string;
  email: string;
  signed_up_at: string;
  last_active_at: string;
  household_id: string | null;
  household_name: string | null;
  member_count: number;
  member_names: string;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const authorized = !!user && user.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const { data, error } = await supabase.rpc("admin_user_summary");
      if (error) { setError(error.message); setRows([]); return; }
      setRows((data ?? []) as Row[]);
    })();
  }, [authorized]);

  if (authLoading) return null;

  if (!authorized) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="space-y-4 text-center">
          <h1 className="font-display text-2xl font-bold">Not authorized</h1>
          <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
        </div>
      </div>
    );
  }

  const filtered = (rows ?? []).filter((r) => {
    const q = search.toLowerCase();
    return r.email.toLowerCase().includes(q) || (r.household_name ?? "").toLowerCase().includes(q);
  });

  const now = new Date();
  const totalUsers = rows?.length ?? 0;
  const activeThisMonth = (rows ?? []).filter((u) => {
    const d = new Date(u.last_active_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const householdsSet = new Set((rows ?? []).map((r) => r.household_id).filter(Boolean));
  const totalHouseholds = householdsSet.size;
  const avgMembers = useMemo(() => {
    if (totalHouseholds === 0) return "0";
    const sum = (rows ?? []).reduce((s, r) => s + (r.household_id ? r.member_count : 0), 0);
    return (sum / totalHouseholds).toFixed(1);
  }, [rows, totalHouseholds]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary">
              <span className="font-display font-bold">S</span>
            </div>
            <span className="font-display text-lg font-bold">Stackly</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin</span>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to app</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total users" value={totalUsers} />
          <Stat label="Active this month" value={activeThisMonth} />
          <Stat label="Total households" value={totalHouseholds} />
          <Stat label="Avg members / household" value={avgMembers} />
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Input
            placeholder="Search by email or household…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {totalUsers} users
          </span>
        </div>

        {error && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Household</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Reach out</th>
              </tr>
            </thead>
            <tbody>
              {rows === null
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.map((r) => {
                    const daysSince = (Date.now() - new Date(r.last_active_at).getTime()) / 86_400_000;
                    const dot = daysSince <= 7 ? "bg-emerald-500" : daysSince <= 30 ? "bg-amber-500" : "bg-muted-foreground/40";
                    return (
                      <tr key={r.user_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{r.email}</td>
                        <td className="px-4 py-3">{r.household_name ?? "No household"}</td>
                        <td className="px-4 py-3">
                          <div>{r.member_count}</div>
                          {r.member_names && <div className="text-xs text-muted-foreground">{r.member_names}</div>}
                        </td>
                        <td className="px-4 py-3">{fmt(r.signed_up_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${dot}`} />
                            {fmt(r.last_active_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`mailto:${r.email}?subject=Stackly feedback`)}
                          >
                            Reach out
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="font-display text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
