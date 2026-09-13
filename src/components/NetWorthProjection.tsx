import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtMoney, isAsset, isLiability } from "@/lib/finance";
import type { Account, Snapshot } from "@/lib/data-hooks";
import {
  buildAccountModels,
  observedMonthlyCash,
  projectScenario,
  scenarioLevers,
  addMonths,
  monthsBetween,
  PROJECTION_MONTHS,
  type Assumptions,
} from "@/lib/projection";

const COLOR_ACTUAL = "oklch(0.62 0.22 277)";
const COLOR_LIKELY = "oklch(0.74 0.17 160)";
const COLOR_BAND = "oklch(0.82 0.16 80)";
const COLOR_GRID = "oklch(0.28 0.05 280)";
const COLOR_AXIS = "oklch(0.7 0.04 270)";

const MIN_WEEKS = 8;

export function NetWorthProjection({
  accounts,
  snapshots,
}: {
  accounts: Account[];
  snapshots: Snapshot[];
}) {
  const models = useMemo(() => buildAccountModels(accounts, snapshots), [accounts, snapshots]);
  const weekCount = useMemo(
    () => new Set(snapshots.map((s) => s.week_ending)).size,
    [snapshots],
  );
  const derivedCash = useMemo(() => Math.round(observedMonthlyCash(models)), [models]);

  const defaults: Assumptions = {
    investReturnPct: 6,
    appreciationPct: 3,
    monthlyCashContribution: derivedCash,
  };
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const current = assumptions ?? defaults;

  const projection = useMemo(() => {
    const levers = scenarioLevers(current);
    const cash = current.monthlyCashContribution;
    return {
      conservative: projectScenario(models, levers.conservative, cash),
      likely: projectScenario(models, levers.likely, cash),
      optimistic: projectScenario(models, levers.optimistic, cash),
    };
  }, [models, current.investReturnPct, current.appreciationPct, current.monthlyCashContribution]);

  const today = new Date();
  const todayNet = projection.likely.netWorth[0] ?? 0;

  const history = useMemo(() => {
    const weeks = Array.from(new Set(snapshots.map((s) => s.week_ending))).sort();
    return weeks.map((w) => {
      let net = 0;
      for (const a of accounts) {
        if (!a.include_in_net_worth || !a.is_active) continue;
        const upTo = snapshots.filter((s) => s.account_id === a.id && s.week_ending <= w);
        const lastRow = upTo[upTo.length - 1];
        if (!lastRow) continue;
        const b = Math.abs(lastRow.balance);
        if (isAsset(a.category)) net += b;
        else if (isLiability(a.category)) net -= b;
      }
      return { date: w, label: w.slice(0, 7), actual: Math.round(net) };
    });
  }, [accounts, snapshots]);

  const chartData = useMemo(() => {
    const rows: any[] = history.map((h) => ({ ...h }));
    for (let m = 0; m <= PROJECTION_MONTHS; m++) {
      const d = addMonths(today, m);
      const label = d.toISOString().slice(0, 7);
      const lo = Math.round(projection.conservative.netWorth[m] ?? 0);
      const hi = Math.round(projection.optimistic.netWorth[m] ?? 0);
      rows.push({
        date: d.toISOString().slice(0, 10),
        label,
        likely: Math.round(projection.likely.netWorth[m] ?? 0),
        bandBase: Math.min(lo, hi),
        bandSpan: Math.abs(hi - lo),
        low: lo,
        high: hi,
        ...(m === 0 ? { actual: Math.round(todayNet) } : {}),
      });
    }
    return rows;
  }, [history, projection, todayNet]);

  const todayLabel = today.toISOString().slice(0, 10);

  const horizons = useMemo(() => {
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const list = [
      { key: "6m", label: "6 months", months: 6 },
      {
        key: "eoy",
        label: `End of ${today.getFullYear()}`,
        months: Math.max(0, Math.min(PROJECTION_MONTHS, monthsBetween(today, endOfYear))),
      },
      { key: "1y", label: "1 year", months: 12 },
      { key: "5y", label: "5 years", months: 60 },
    ];
    return list.map((h) => ({
      ...h,
      likely: projection.likely.netWorth[h.months] ?? 0,
      low: projection.conservative.netWorth[h.months] ?? 0,
      high: projection.optimistic.netWorth[h.months] ?? 0,
    }));
  }, [projection]);

  if (weekCount < MIN_WEEKS) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-semibold">Net worth projection</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          More history is needed to project forward. You have {weekCount} week
          {weekCount === 1 ? "" : "s"} of snapshots so far — projections start at {MIN_WEEKS} weeks.
        </p>
      </div>
    );
  }

  const set = (patch: Partial<Assumptions>) => setAssumptions({ ...current, ...patch });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Net worth projection</h2>
        <p className="text-sm text-muted-foreground">Where your net worth is heading.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {horizons.map((h) => {
          const delta = h.likely - todayNet;
          return (
            <div key={h.key} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="text-sm text-muted-foreground">{h.label}</div>
              <div className="mt-1 font-display text-2xl font-bold">{fmtMoney(h.likely)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {fmtMoney(Math.min(h.low, h.high))} – {fmtMoney(Math.max(h.low, h.high))}
              </div>
              <div className={`mt-2 text-sm font-medium ${delta >= 0 ? "text-success" : "text-destructive"}`}>
                {delta >= 0 ? "+" : "−"}
                {fmtMoney(Math.abs(delta))} vs today
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h3 className="font-display text-lg font-semibold">Assumptions</h3>
          <Button variant="outline" size="sm" onClick={() => setAssumptions(null)}>
            Reset to my trend
          </Button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="proj-return">Investment return (% / yr)</Label>
            <Input
              id="proj-return"
              type="number"
              step="0.5"
              value={current.investReturnPct}
              onChange={(e) => set({ investReturnPct: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-appr">Asset appreciation (% / yr)</Label>
            <Input
              id="proj-appr"
              type="number"
              step="0.5"
              value={current.appreciationPct}
              onChange={(e) => set({ appreciationPct: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-cash">Monthly cash contribution ($)</Label>
            <Input
              id="proj-cash"
              type="number"
              step="50"
              value={current.monthlyCashContribution}
              onChange={(e) => set({ monthlyCashContribution: Number(e.target.value) })}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Conservative and Optimistic shift around these: ±3% return, ±2% appreciation, and 75% /
          125% of the cash contribution. Debt paydown stays at your observed rate in all scenarios.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">History &amp; projection</h3>
          <div className="text-sm text-muted-foreground">
            Today: <span className="font-semibold text-foreground">{fmtMoney(todayNet)}</span>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke={COLOR_AXIS} fontSize={12} tickFormatter={(v: string) => String(v).slice(0, 7)} minTickGap={40} />
              <YAxis stroke={COLOR_AXIS} fontSize={12} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "oklch(0.18 0.05 280)", border: `1px solid ${COLOR_GRID}`, borderRadius: 8 }}
                formatter={(v: number, name: string) => [fmtMoney(v), name]}
                labelFormatter={(l: string) => String(l).slice(0, 7)}
              />
              <Legend />
              <Area
                dataKey="bandBase"
                stackId="band"
                stroke="none"
                fill="transparent"
                legendType="none"
                name="Range floor"
                isAnimationActive={false}
              />
              <Area
                dataKey="bandSpan"
                stackId="band"
                stroke="none"
                fill={COLOR_BAND}
                fillOpacity={0.18}
                name="Conservative – Optimistic"
                isAnimationActive={false}
              />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={COLOR_ACTUAL} strokeWidth={2} dot={false} connectNulls />
              <Line
                type="monotone"
                dataKey="likely"
                name="Likely projection"
                stroke={COLOR_LIKELY}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
              <ReferenceLine x={todayLabel} stroke={COLOR_AXIS} strokeDasharray="4 4" label={{ value: "Today", fill: COLOR_AXIS, fontSize: 11, position: "insideTopLeft" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Based on {weekCount} weeks of history. This is an estimate, not a guarantee — actual
          results will vary with markets, income and spending.
        </p>
      </div>
    </div>
  );
}
