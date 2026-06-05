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
  spending_30d: number;
  spending_total: number;
  last_entry_at: string | null;
  activity_score: number;
};

type SortKey =
  | "email"
  | "household_name"
  | "member_count"
  | "signed_up_at"
  | "last_active_at"
  | "spending_30d"
  | "activity_score"
  | "last_entry_at";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function relTime(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const day = 86_400_000;
  if (diff < day) {
    const h = Math.max(1, Math.floor(diff / 3_600_000));
    return `${h}h ago`;
  }
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function scoreColor(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  if (score >= 15) return "bg-orange-500";
  return "bg-muted-foreground/40";
}

function scoreLabel(score: number) {
  if (score >= 70) return "Highly active";
  if (score >= 40) return "Active";
  if (score >= 15) return "Light";
  return "Inactive";
}

function lastSeenDot(d: string) {
  const days = (Date.now() - new Date(d).getTime()) / 86_400_000;
  if (days <= 7) return "bg-emerald-500";
  if (days <= 30) return "bg-amber-500";
  return "bg-muted-foreground/40";
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("activity_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Client-side email gate on top of the RPC's server-side check
  const clientGate = !!user && ADMIN_EMAILS.some((e) => e.toLowerCase() === (user.email ?? "").toLowerCase());

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = (rows ?? []).filter(
      (r) => r.email.toLowerCase().includes(q) || (r.household_name ?? "").toLowerCase().includes(q),
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, search, sortKey, sortDir]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const now = new Date();
    const totalUsers = list.length;
    const activeThisMonth = list.filter((u) => {
      const d = new Date(u.last_active_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const active7d = list.filter((u) => Date.now() - new Date(u.last_active_at).getTime() < 7 * 86_400_000).length;
    const householdsSet = new Set(list.map((r) => r.household_id).filter(Boolean));
    const totalHouseholds = householdsSet.size;
    const engaged = list.filter((u) => u.spending_30d > 0).length;
    const engagedPct = totalUsers ? Math.round((engaged / totalUsers) * 100) : 0;
    const avgScore = totalUsers
      ? Math.round(list.reduce((s, r) => s + r.activity_score, 0) / totalUsers)
      : 0;
    const avgMembers = totalHouseholds
      ? (list.reduce((s, r) => s + (r.household_id ? r.member_count : 0), 0) / totalHouseholds).toFixed(1)
      : "0";
    return { totalUsers, activeThisMonth, active7d, totalHouseholds, engagedPct, avgScore, avgMembers };
  }, [rows]);

  if (authLoading || authorized === null) return null;

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "email" || key === "household_name" ? "asc" : "desc");
    }
  }

  function SortHeader({ k, label, className = "" }: { k: SortKey; label: string; className?: string }) {
    const active = sortKey === k;
    return (
      <th className={`px-4 py-3 ${className}`}>
        <button
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
        >
          {label}
          <span className="text-xs opacity-60">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
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
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Total users" value={stats.totalUsers} />
          <Stat label="Active 7d" value={stats.active7d} />
          <Stat label="Active this month" value={stats.activeThisMonth} />
          <Stat label="Households" value={stats.totalHouseholds} />
          <Stat label="Avg members" value={stats.avgMembers} />
          <Stat label="Engaged 30d" value={`${stats.engagedPct}%`} />
          <Stat label="Avg activity" value={stats.avgScore} />
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Input
            placeholder="Search by email or household…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {stats.totalUsers} users
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SortHeader k="email" label="Email" />
                  <SortHeader k="household_name" label="Household" />
                  <SortHeader k="member_count" label="Members" />
                  <SortHeader k="activity_score" label="Activity" />
                  <SortHeader k="spending_30d" label="Entries 30d" />
                  <SortHeader k="last_entry_at" label="Last entry" />
                  <SortHeader k="last_active_at" label="Last seen" />
                  <SortHeader k="signed_up_at" label="Signed up" />
                  <th className="px-4 py-3">Reach out</th>
                </tr>
              </thead>
              <tbody>
                {rows === null
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.map((r) => (
                      <tr key={r.user_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{r.email}</td>
                        <td className="px-4 py-3">
                          {r.household_name ?? <span className="text-muted-foreground">No household</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div>{r.member_count}</div>
                          {r.member_names && (
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground">{r.member_names}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full ${scoreColor(r.activity_score)}`}
                                style={{ width: `${r.activity_score}%` }}
                              />
                            </div>
                            <span className="w-8 text-right tabular-nums">{r.activity_score}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{scoreLabel(r.activity_score)}</div>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          <div>{r.spending_30d}</div>
                          <div className="text-xs text-muted-foreground">{r.spending_total} total</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{relTime(r.last_entry_at)}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(r.last_entry_at)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${lastSeenDot(r.last_active_at)}`} />
                            {relTime(r.last_active_at)}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDate(r.last_active_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.signed_up_at)}</td>
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
              </tbody>
            </table>
          </div>
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
