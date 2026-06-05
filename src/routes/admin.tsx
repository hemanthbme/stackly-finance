import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_EMAILS = ["hmdbme@gmail.com", "hemanth.bme@gmail.com"];

type Row = {
  user_id: string;
  email: string;
  signed_up_at: string;
  last_active_at: string;
  household_id: string | null;
  household_name: string | null;
  member_count: number;
  member_names: string;
  account_count: number;
  snapshot_count: number;
  spending_30d: number;
  spending_total: number;
  last_entry_at: string | null;
  activity_score: number;
};

const StatBox = ({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: number | string;
  color?: string;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-card text-center">
    <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-muted-foreground mt-1">{label}</div>
  </div>
);

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<"signup" | "active" | "activity">("signup");

  const clientGate =
    !!user && ADMIN_EMAILS.some((e) => e.toLowerCase() === (user.email ?? "").toLowerCase());

  useEffect(() => {
    if (authLoading) return;
    if (!user || !clientGate) {
      setAuthorized(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("admin_user_summary");
      if (error) {
        setAuthorized(false);
        setError(error.message);
        return;
      }
      setAuthorized(true);
      setRows((data ?? []) as Row[]);
    })();
  }, [user, authLoading, clientGate]);

  const enrichedRows = useMemo(() => {
    return (rows ?? []).map((r) => {
      const snapshots = r.snapshot_count ?? 0;
      const spending = r.spending_total ?? 0;
      const accounts = r.account_count ?? 0;

      const signupDate = new Date(r.signed_up_at);
      const lastActive = new Date(r.last_active_at);
      const now = new Date();
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / 86400000);
      const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / 86400000);

      const activityScore = snapshots * 3 + spending * 2 + accounts * 5;
      const activityLabel =
        activityScore === 0 ? "None" : activityScore < 10 ? "Low" : activityScore < 40 ? "Medium" : "High";
      const activityColor =
        activityScore === 0
          ? "text-muted-foreground"
          : activityScore < 10
            ? "text-warning"
            : activityScore < 40
              ? "text-primary"
              : "text-success";

      const lastSeenLabel =
        daysSinceActive === 0 ? "Today" : daysSinceActive === 1 ? "Yesterday" : `${daysSinceActive}d ago`;
      const lastSeenColor =
        daysSinceActive <= 1 ? "text-success" : daysSinceActive <= 7 ? "text-warning" : "text-muted-foreground";

      return {
        ...r,
        snapshots,
        spending,
        accounts,
        daysSinceSignup,
        daysSinceActive,
        activityScore,
        activityLabel,
        activityColor,
        lastSeenLabel,
        lastSeenColor,
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const list = enrichedRows
      .filter((r) => {
        const q = search.toLowerCase();
        return r.email.toLowerCase().includes(q) || (r.household_name ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === "active") return a.daysSinceActive - b.daysSinceActive;
        if (sortBy === "activity") return b.activityScore - a.activityScore;
        return new Date(b.signed_up_at).getTime() - new Date(a.signed_up_at).getTime();
      });
    return list;
  }, [enrichedRows, search, sortBy]);

  const now = new Date();
  const activeThisMonth = enrichedRows.filter((u) => {
    const d = new Date(u.last_active_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const totalHouseholds = new Set(enrichedRows.map((r) => r.household_id).filter(Boolean)).size;

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="space-y-4 text-center">
          <h1 className="font-display text-2xl font-bold">Admin access</h1>
          <p className="text-sm text-muted-foreground">Please sign in to continue.</p>
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (authorized === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="space-y-4 text-center">
          <h1 className="font-display text-2xl font-bold">Not authorized</h1>
          {error && <p className="text-sm text-muted-foreground">{error}</p>}
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary">
              <span className="font-display font-bold">S</span>
            </div>
            <span className="font-display text-lg font-bold">Stackly</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin
            </span>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <StatBox label="Total users" value={enrichedRows.length} />
          <StatBox
            label="Active today"
            value={enrichedRows.filter((r) => r.daysSinceActive === 0).length}
            color="text-success"
          />
          <StatBox
            label="Active this week"
            value={enrichedRows.filter((r) => r.daysSinceActive <= 7).length}
            color="text-primary"
          />
          <StatBox label="Active this month" value={activeThisMonth} />
          <StatBox label="Total households" value={totalHouseholds} />
          <StatBox
            label="High engagement"
            value={enrichedRows.filter((r) => r.activityLabel === "High").length}
            color="text-success"
          />
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Input
            placeholder="Search by email or household..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "signup" | "active" | "activity")}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="signup">Sort by signup date</option>
            <option value="active">Sort by last active</option>
            <option value="activity">Sort by activity score</option>
          </select>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} of {enrichedRows.length} users
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: 1000 }}>
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-48">Email</th>
                  <th className="px-4 py-3 w-36">Household</th>
                  <th className="px-4 py-3 w-20">Members</th>
                  <th className="px-4 py-3 w-20">Accounts</th>
                  <th className="px-4 py-3 w-20">Snapshots</th>
                  <th className="px-4 py-3 w-20">Spending</th>
                  <th className="px-4 py-3 w-24">Member for</th>
                  <th className="px-4 py-3 w-24">Last seen</th>
                  <th className="px-4 py-3 w-20">Activity</th>
                  <th className="px-4 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 truncate font-medium">{r.email}</td>
                    <td className="px-4 py-3 truncate text-muted-foreground">{r.household_name ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{r.member_count}</td>
                    <td className="px-4 py-3 text-center">{r.accounts}</td>
                    <td className="px-4 py-3 text-center">{r.snapshots}</td>
                    <td className="px-4 py-3 text-center">{r.spending}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.daysSinceSignup}d</td>
                    <td className={`px-4 py-3 font-medium ${r.lastSeenColor}`}>{r.lastSeenLabel}</td>
                    <td className={`px-4 py-3 font-medium text-xs ${r.activityColor}`}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.activityLabel === "High"
                            ? "bg-success/10 text-success"
                            : r.activityLabel === "Medium"
                              ? "bg-primary/10 text-primary"
                              : r.activityLabel === "Low"
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.activityLabel}
                      </span>
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
                ))}
                {filtered.length === 0 && rows !== null && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
