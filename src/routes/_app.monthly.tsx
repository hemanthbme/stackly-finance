import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useAccounts, useSnapshots } from "@/lib/data-hooks";
import { fmtMoney, isAsset, isLiability } from "@/lib/finance";
import { TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/monthly")({
  component: () => (<RequireHousehold><MonthlyPage /></RequireHousehold>),
});

function MonthlyPage() {
  const { data: accounts } = useAccounts();
  const { data: snapshots } = useSnapshots();

  const months = useMemo(() => {
    const byMonth = new Map<string, string[]>();
    for (const s of snapshots) {
      const m = s.week_ending.slice(0, 7);
      const arr = byMonth.get(m) ?? []; arr.push(s.week_ending); byMonth.set(m, arr);
    }
    const keys = Array.from(byMonth.keys()).sort();
    return keys.map((m) => {
      const weeks = Array.from(new Set(byMonth.get(m)!)).sort();
      const first = weeks[0]; const last = weeks[weeks.length - 1];
      let assets = 0, liabs = 0, prevAssets = 0, prevLiabs = 0;
      for (const a of accounts) {
        if (!a.include_in_net_worth) continue;
        const lastSnap = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= last).slice(-1)[0];
        const firstSnap = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= first).slice(-1)[0];
        if (lastSnap) { if (isAsset(a.category)) assets += lastSnap.balance; if (isLiability(a.category)) liabs += lastSnap.balance; }
        if (firstSnap) { if (isAsset(a.category)) prevAssets += firstSnap.balance; if (isLiability(a.category)) prevLiabs += firstSnap.balance; }
      }
      return { month: m, first, last, net: assets - liabs, prevNet: prevAssets - prevLiabs, change: (assets - liabs) - (prevAssets - prevLiabs), savingsGrowth: assets - prevAssets, debtReduction: prevLiabs - liabs };
    });
  }, [accounts, snapshots]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Monthly Summary</h1>
        <p className="text-sm text-muted-foreground">Auto-grouped from your weekly snapshots.</p>
      </div>

      {months.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No monthly data yet.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Net Worth (end)</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Savings Growth</th>
                <th className="px-4 py-3">Debt Reduction</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.month} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{m.month}</td>
                  <td className="px-4 py-3">{fmtMoney(m.net)}</td>
                  <td className={`px-4 py-3 ${m.change >= 0 ? "text-success" : "text-destructive"}`}>
                    <span className="inline-flex items-center gap-1">{m.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{fmtMoney(Math.abs(m.change))}</span>
                  </td>
                  <td className="px-4 py-3 text-success">{fmtMoney(Math.max(0, m.savingsGrowth))}</td>
                  <td className="px-4 py-3 text-success">{fmtMoney(Math.max(0, m.debtReduction))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
