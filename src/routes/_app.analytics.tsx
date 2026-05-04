import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useAccounts, useSnapshots } from "@/lib/data-hooks";
import { CATEGORY_LABELS, fmtMoney, isAsset, isLiability, type AccountCategory } from "@/lib/finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_app/analytics")({
  component: () => (<RequireHousehold><AnalyticsPage /></RequireHousehold>),
});

function AnalyticsPage() {
  const { data: accounts } = useAccounts();
  const { data: snapshots } = useSnapshots();
  const [view, setView] = useState<"net" | "assets" | "liabilities" | "category" | "account">("net");
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [categoryFilter, setCategoryFilter] = useState<AccountCategory>("checking");

  const weeks = useMemo(() => Array.from(new Set(snapshots.map((s) => s.week_ending))).sort(), [snapshots]);

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
          if (isLiability(a.category)) liabs += last.balance;
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
