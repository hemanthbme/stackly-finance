import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useAccounts, useSnapshots } from "@/lib/data-hooks";
import { CATEGORY_LABELS, CASH_CATEGORIES, INVESTMENT_CATEGORIES, RETIREMENT_CATEGORIES, fmtMoney, isAsset, isLiability, type AccountCategory } from "@/lib/finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart, ReferenceLine, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useHousehold } from "@/lib/household-context";
import { useProfile } from "@/lib/profile-context";
import { supabase } from "@/integrations/supabase/client";
import { todayInTz } from "@/lib/tz";

export const Route = createFileRoute("/_app/analytics")({
  component: () => (<RequireHousehold><AnalyticsPage /></RequireHousehold>),
});

function AnalyticsPage() {
  const { data: accounts } = useAccounts();
  const { data: snapshots } = useSnapshots();
  const [view, setView] = useState<"net" | "assets" | "liabilities" | "category" | "account">("net");
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [categoryFilter, setCategoryFilter] = useState<AccountCategory>("checking");
  const [range, setRange] = useState<"3M" | "6M" | "1Y" | "All">("All");

  const weeks = useMemo(() => {
    const all = Array.from(new Set(snapshots.map((s) => s.week_ending))).sort();
    if (range === "All") return all;
    const days = range === "3M" ? 90 : range === "6M" ? 180 : 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return all.filter((w) => w >= cutoffIso);
  }, [snapshots, range]);

  const series = useMemo(() => {
    return weeks.map((w) => {
      const point: Record<string, any> = { week: w };
      let assets = 0, liabs = 0, catSum = 0;
      for (const a of accounts) {
        const upTo = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= w);
        const last = upTo[upTo.length - 1];
        if (!last) continue;
        if (a.include_in_net_worth) {
          if (isAsset(a.category)) assets += last.balance;
          if (isLiability(a.category)) liabs += Math.abs(last.balance);
        }
        if (a.category === categoryFilter) catSum += last.balance;
        if (a.id === accountId) point.account = last.balance;
      }
      point.assets = assets;
      point.liabilities = liabs;
      point.net = assets - liabs;
      point.category = catSum;
      return point;
    });
  }, [weeks, accounts, snapshots, accountId, categoryFilter]);

  // Assets vs Liabilities series — both lines on same chart
  const assetsVsLiabsSeries = useMemo(() => {
    return weeks.map((w) => {
      let assets = 0, liabs = 0;
      for (const a of accounts) {
        if (!a.include_in_net_worth) continue;
        const upTo = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= w);
        const last = upTo[upTo.length - 1];
        if (!last) continue;
        if (isAsset(a.category)) assets += last.balance;
        if (isLiability(a.category)) liabs += Math.abs(last.balance);
      }
      return { week: w.slice(5), assets, liabilities: liabs };
    });
  }, [weeks, accounts, snapshots]);

  // Debt only series
  const debtSeries = useMemo(() => {
    return weeks.map((w) => {
      let debt = 0;
      for (const a of accounts) {
        if (!isLiability(a.category as any) || !a.include_in_net_worth) continue;
        const upTo = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= w);
        const last = upTo[upTo.length - 1];
        if (!last) continue;
        debt += Math.abs(last.balance);
      }
      return { week: w.slice(5), debt };
    });
  }, [weeks, accounts, snapshots]);

  // Retirement series
  const retireSeries = useMemo(() => {
    return weeks.map((w) => {
      let retire = 0;
      for (const a of accounts) {
        if (!RETIREMENT_CATEGORIES.includes(a.category as any)) continue;
        const upTo = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= w);
        const last = upTo[upTo.length - 1];
        if (!last) continue;
        retire += last.balance;
      }
      return { week: w.slice(5), retirement: retire };
    });
  }, [weeks, accounts, snapshots]);

  // Investment series (brokerage only)
  const investSeries = useMemo(() => {
    return weeks.map((w) => {
      let invest = 0;
      for (const a of accounts) {
        if (!INVESTMENT_CATEGORIES.includes(a.category as any)) continue;
        const upTo = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= w);
        const last = upTo[upTo.length - 1];
        if (!last) continue;
        invest += last.balance;
      }
      return { week: w.slice(5), investments: invest };
    });
  }, [weeks, accounts, snapshots]);

  const { active } = useHousehold();
  const { profile } = useProfile();
  const tz = profile?.user_timezone || "UTC";
  const today = todayInTz(tz);
  const [spendingByMonth, setSpendingByMonth] = useState<{ month: string; spent: number; budget: number; returned: number }[]>([]);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const [entriesRes, budgetRes] = await Promise.all([
        supabase.from("spending_entries").select("amount,spent_at,spent_local_date,notes").eq("household_id", active.id),
        supabase.from("budgets").select("daily_limit,budget_type,period,is_active").eq("household_id", active.id),
      ]);
      const b = (budgetRes.data ?? []).find((x: any) => x.budget_type === "combined" && x.period === "daily" && x.is_active);
      const dailyLimit = b ? Number(b.daily_limit) : 0;
      const entries = entriesRes.data ?? [];

      const monthMap = new Map<string, { spent: number; returned: number; days: number }>();
      for (const e of entries) {
        const d = (e as any).spent_local_date || (e as any).spent_at;
        const mon = String(d).slice(0, 7);
        const notes = (e as any).notes ?? "";
        const isCredit = notes.startsWith("[CREDIT]");
        const isFixed = notes.startsWith("[FIXED]");
        if (!monthMap.has(mon)) {
          const daysInMon = new Date(Number(mon.slice(0, 4)), Number(mon.slice(5, 7)), 0).getDate();
          monthMap.set(mon, { spent: 0, returned: 0, days: daysInMon });
        }
        const entry = monthMap.get(mon)!;
        if (isCredit) entry.returned += Number((e as any).amount);
        else if (!isFixed) entry.spent += Number((e as any).amount);
      }

      const result = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, { spent, returned, days }]) => ({
          month: new Date(month + "-15").toLocaleString("default", { month: "short", year: "2-digit" }),
          spent: Math.round(spent),
          returned: Math.round(returned),
          budget: dailyLimit * days,
        }));
      setSpendingByMonth(result);
    })();
  }, [active?.id]);

  const chartLines: { key: string; name: string; color: string }[] =
    view === "net" ? [{ key: "net", name: "Net Worth", color: "oklch(0.62 0.22 277)" }]
    : view === "assets" ? [{ key: "assets", name: "Assets", color: "oklch(0.74 0.17 160)" }]
    : view === "liabilities" ? [{ key: "liabilities", name: "Liabilities", color: "oklch(0.65 0.24 20)" }]
    : view === "category" ? [{ key: "category", name: CATEGORY_LABELS[categoryFilter], color: "oklch(0.72 0.21 290)" }]
    : [{ key: "account", name: accounts.find((a) => a.id === accountId)?.name ?? "Account", color: "oklch(0.82 0.16 80)" }];

  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const k = chartLines[0].key;
  const wk = last && prev ? (last[k] || 0) - (prev[k] || 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Trends across every metric you track.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={view} onValueChange={(v) => setView(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="net">Net Worth</SelectItem>
            <SelectItem value="assets">Total Assets</SelectItem>
            <SelectItem value="liabilities">Total Liabilities</SelectItem>
            <SelectItem value="category">By Category</SelectItem>
            <SelectItem value="account">By Account</SelectItem>
          </SelectContent>
        </Select>
        {view === "category" && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as AccountCategory)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {view === "account" && (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Pick an account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["3M", "6M", "1Y", "All"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                range === r
                  ? "bg-gradient-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {r}
            </button>
          ))}
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Assets vs Liabilities</h3>
            <div className="text-sm text-muted-foreground">
              Latest assets: <span className="font-semibold text-success">{fmtMoney(assetsVsLiabsSeries[assetsVsLiabsSeries.length - 1]?.assets ?? 0)}</span>
              {" · "}Liabilities: <span className="font-semibold text-warning">{fmtMoney(assetsVsLiabsSeries[assetsVsLiabsSeries.length - 1]?.liabilities ?? 0)}</span>
            </div>
          </div>
          {assetsVsLiabsSeries.length === 0 ? (
            <div className="grid h-72 place-items-center text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={assetsVsLiabsSeries}>
                  <defs>
                    <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.74 0.17 160)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.74 0.17 160)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.28 0.05 280)" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="oklch(0.7 0.04 270)" fontSize={12} />
                  <YAxis stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.05 280)", border: "1px solid oklch(0.28 0.05 280)", borderRadius: 8 }} formatter={(v: number) => fmtMoney(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="assets" name="Assets" stroke="oklch(0.74 0.17 160)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="liabilities" name="Liabilities" stroke="oklch(0.65 0.24 20)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Debt over time</h3>
            <div className="text-sm text-muted-foreground">
              Current: <span className="font-semibold text-warning">{fmtMoney(debtSeries[debtSeries.length - 1]?.debt ?? 0)}</span>
              {debtSeries.length >= 2 && (
                <span className={`ml-2 ${(debtSeries[debtSeries.length - 1]?.debt ?? 0) < (debtSeries[debtSeries.length - 2]?.debt ?? 0) ? "text-success" : "text-destructive"}`}>
                  {(debtSeries[debtSeries.length - 1]?.debt ?? 0) < (debtSeries[debtSeries.length - 2]?.debt ?? 0) ? "↓ decreasing" : "↑ increasing"}
                </span>
              )}
            </div>
          </div>
          {debtSeries.length === 0 ? (
            <div className="grid h-72 place-items-center text-sm text-muted-foreground">No debt accounts tracked.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={debtSeries}>
                  <defs>
                    <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.24 20)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="oklch(0.65 0.24 20)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.28 0.05 280)" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="oklch(0.7 0.04 270)" fontSize={12} />
                  <YAxis stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.05 280)", border: "1px solid oklch(0.28 0.05 280)", borderRadius: 8 }} formatter={(v: number) => fmtMoney(v)} />
                  <Area type="monotone" dataKey="debt" name="Total Debt" stroke="oklch(0.65 0.24 20)" strokeWidth={2} fill="url(#debtGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Retirement & Investments</h3>
            <div className="text-sm text-muted-foreground">
              Retirement: <span className="font-semibold text-primary">{fmtMoney(retireSeries[retireSeries.length - 1]?.retirement ?? 0)}</span>
              {" · "}Investments: <span className="font-semibold" style={{ color: "oklch(0.82 0.16 80)" }}>{fmtMoney(investSeries[investSeries.length - 1]?.investments ?? 0)}</span>
            </div>
          </div>
          {retireSeries.length === 0 && investSeries.length === 0 ? (
            <div className="grid h-72 place-items-center text-sm text-muted-foreground">No retirement or investment accounts tracked.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeks.map((w, i) => ({ week: w.slice(5), retirement: retireSeries[i]?.retirement ?? 0, investments: investSeries[i]?.investments ?? 0 }))}>
                  <CartesianGrid stroke="oklch(0.28 0.05 280)" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="oklch(0.7 0.04 270)" fontSize={12} />
                  <YAxis stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.05 280)", border: "1px solid oklch(0.28 0.05 280)", borderRadius: 8 }} formatter={(v: number) => fmtMoney(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="retirement" name="Retirement" stroke="oklch(0.62 0.22 277)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="investments" name="Investments" stroke="oklch(0.82 0.16 80)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Monthly spending vs budget</h3>
            <div className="text-sm text-muted-foreground">Last 12 months · variable only</div>
          </div>
          {spendingByMonth.length === 0 ? (
            <div className="grid h-72 place-items-center text-sm text-muted-foreground">No spending data yet.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={spendingByMonth}>
                  <CartesianGrid stroke="oklch(0.28 0.05 280)" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="oklch(0.7 0.04 270)" fontSize={12} />
                  <YAxis stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.18 0.05 280)", border: "1px solid oklch(0.28 0.05 280)", borderRadius: 8 }}
                    formatter={(v: number, name: string) => [fmtMoney(v), name]}
                  />
                  <Legend />
                  <Bar dataKey="spent" name="Spent" fill="oklch(0.62 0.22 277)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="returned" name="Returned" fill="oklch(0.74 0.17 160)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line type="monotone" dataKey="budget" name="Budget limit" stroke="oklch(0.65 0.24 20)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg font-semibold">{chartLines[0].name}</h3>
          <div className="text-sm text-muted-foreground">
            Latest: <span className="font-semibold text-foreground">{fmtMoney(last?.[k] || 0)}</span>
            {" · "}WoW: <span className={wk >= 0 ? "text-success" : "text-destructive"}>{wk >= 0 ? "+" : "-"}{fmtMoney(Math.abs(wk))}</span>
          </div>
        </div>
        {series.length === 0 ? (
          <div className="grid h-72 place-items-center text-sm text-muted-foreground">No data yet.</div>
        ) : (
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid stroke="oklch(0.28 0.05 280)" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.05 280)", border: "1px solid oklch(0.28 0.05 280)", borderRadius: 8 }} formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                {chartLines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
