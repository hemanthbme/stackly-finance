import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { fmtMoney } from "@/lib/finance";

export interface ForecastModel {
  id: "linear" | "fixed_variable" | "day_weighted" | "monte_carlo";
  name: string;
  tagline: string;
  explanation: string;
  requiredMonths: number;
  accuracy: "Basic" | "Good" | "Great" | "Advanced";
}

export const FORECAST_MODELS: ForecastModel[] = [
  {
    id: "linear",
    name: "Linear Trend",
    tagline: "Simple daily average projected forward",
    explanation:
      "Takes your average daily spending so far this month and multiplies it by the number of days in the month. Easy to understand but can be inaccurate early in the month when you have only a few data points. Best used as a baseline.",
    requiredMonths: 0,
    accuracy: "Basic",
  },
  {
    id: "fixed_variable",
    name: "Fixed vs Variable",
    tagline: "Separates known costs from flexible spending",
    explanation:
      "Splits your spending into fixed costs (recurring entries like rent, subscriptions, loan payments) and variable costs (food, entertainment, shopping). Projects fixed costs exactly since they are known, and estimates variable costs from your daily average. Significantly more accurate than linear once you have recurring entries set up.",
    requiredMonths: 2,
    accuracy: "Good",
  },
  {
    id: "day_weighted",
    name: "Day-of-Week Weighted",
    tagline: "Accounts for your weekend vs weekday patterns",
    explanation:
      "Most households spend more on weekends than weekdays — groceries on Saturday, dining out on Friday. This model looks at your historical spending by day of week across the past 8+ weeks and weights future projections accordingly. If you typically spend $80 on Saturdays but only $25 on Tuesdays, the projection reflects that instead of treating every day equally.",
    requiredMonths: 3,
    accuracy: "Great",
  },
  {
    id: "monte_carlo",
    name: "Monte Carlo Simulation",
    tagline: "Probability range across 1,000 simulated futures",
    explanation:
      "Instead of one projection number, this model runs 1,000 simulated versions of the rest of your month using your historical spending patterns and natural variance. The result is a probability range — for example, a 75% chance you finish under budget, with a likely overspend of up to $150 in the worst case. The most realistic picture of financial uncertainty available.",
    requiredMonths: 6,
    accuracy: "Advanced",
  },
];

export function countMonthsOfData(entries: { spent_at: string }[]): number {
  const months = new Set(entries.map((e) => e.spent_at.slice(0, 7)));
  return months.size;
}

export function linearForecast(
  totalSoFar: number,
  daysElapsed: number,
  daysInMonth: number,
  lastMonthTotal: number,
): { projected: number; method: string } {
  if (daysElapsed < 7 && lastMonthTotal > 0) {
    const currentPace = (totalSoFar / daysElapsed) * daysInMonth;
    const projected = lastMonthTotal * 0.6 + currentPace * 0.4;
    return { projected, method: "Blended (early month)" };
  }
  const projected = (totalSoFar / Math.max(1, daysElapsed)) * daysInMonth;
  return { projected, method: "Daily average × days in month" };
}

export function fixedVariableForecast(
  totalSoFar: number,
  daysElapsed: number,
  daysRemaining: number,
  daysInMonth: number,
  recurringEntries: { amount: number }[],
  _allEntries: { spent_at: string; amount: number }[],
  _today: string,
): { projected: number; fixedRemaining: number; variableProjected: number; method: string } {
  const fixedMonthlyTotal = recurringEntries.reduce((s, r) => s + r.amount, 0);
  const fixedRemaining = Math.max(0, fixedMonthlyTotal - 0);
  const variableSpentSoFar = Math.max(0, totalSoFar - fixedMonthlyTotal * (daysElapsed / daysInMonth));
  const variableDailyAvg = variableSpentSoFar / Math.max(1, daysElapsed);
  const variableProjected = variableDailyAvg * daysRemaining;
  const projected = totalSoFar + fixedRemaining + variableProjected;
  return { projected, fixedRemaining, variableProjected, method: "Fixed costs + variable daily avg" };
}

export function dayWeightedForecast(
  allEntries: { spent_at: string; amount: number }[],
  today: string,
  daysInMonth: number,
  monthStart: string,
): { projected: number; weights: number[]; method: string } {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 84);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const recent = allEntries.filter((e) => e.spent_at >= cutoffIso && e.spent_at < monthStart);

  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const e of recent) {
    const d = new Date(e.spent_at + "T12:00:00").getDay();
    dowTotals[d] += e.amount;
    dowCounts[d]++;
  }
  const dowAvg = dowTotals.map((t, i) => (dowCounts[i] > 0 ? t / dowCounts[i] : null));
  const distinctDays = new Set(recent.map((e) => e.spent_at)).size;
  const globalAvg = recent.reduce((s, e) => s + e.amount, 0) / Math.max(1, distinctDays);
  const weights = dowAvg.map((v) => v ?? globalAvg);

  const [yy, mm] = monthStart.split("-").map(Number);
  const todayDay = new Date(today + "T12:00:00").getDate();
  let projectedRemaining = 0;
  for (let d = todayDay + 1; d <= daysInMonth; d++) {
    const dow = new Date(yy, mm - 1, d).getDay();
    projectedRemaining += weights[dow];
  }

  const actualSoFar = allEntries
    .filter((e) => e.spent_at >= monthStart && e.spent_at <= today)
    .reduce((s, e) => s + e.amount, 0);

  return { projected: actualSoFar + projectedRemaining, weights, method: "Historical day-of-week averages" };
}

export function monteCarloForecast(
  allEntries: { spent_at: string; amount: number }[],
  today: string,
  daysInMonth: number,
  monthStart: string,
  simulations = 1000,
): {
  projected: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  probUnderBudget: number;
  budget: number;
  method: string;
  results: number[];
} {
  const todayDay = new Date(today + "T12:00:00").getDate();
  const daysRemaining = daysInMonth - todayDay;

  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - 3);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const historical = allEntries.filter((e) => e.spent_at >= cutoffIso && e.spent_at < monthStart);

  const byDay = new Map<string, number>();
  for (const e of historical) {
    byDay.set(e.spent_at, (byDay.get(e.spent_at) ?? 0) + e.amount);
  }
  const dailySamples = Array.from(byDay.values());
  if (dailySamples.length < 10) {
    const distinctDays = new Set(historical.map((e) => e.spent_at)).size;
    const avg = historical.reduce((s, e) => s + e.amount, 0) / Math.max(1, distinctDays);
    dailySamples.push(...Array(20).fill(avg));
  }

  const actualSoFar = allEntries
    .filter((e) => e.spent_at >= monthStart && e.spent_at <= today)
    .reduce((s, e) => s + e.amount, 0);

  const results: number[] = [];
  for (let i = 0; i < simulations; i++) {
    let sim = actualSoFar;
    for (let d = 0; d < daysRemaining; d++) {
      const sample = dailySamples[Math.floor(Math.random() * dailySamples.length)];
      sim += sample;
    }
    results.push(sim);
  }
  results.sort((a, b) => a - b);

  const p = (pct: number) => results[Math.floor((pct / 100) * simulations)] ?? 0;
  const median = p(50);

  return {
    projected: median,
    p10: p(10),
    p25: p(25),
    p75: p(75),
    p90: p(90),
    probUnderBudget: 0,
    budget: 0,
    method: `Median of ${simulations} simulations`,
    results,
  };
}

interface ForecastEngineProps {
  spending: { spent_at: string; amount: number; member_id: string | null }[];
  recurringEntries: { amount: number; label: string }[];
  monthStart: string;
  today: string;
  monthlyLimit: number;
  totalMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;
  lastMonthTotal: number;
}

const ACCURACY_BADGE: Record<ForecastModel["accuracy"], string> = {
  Basic: "bg-muted text-muted-foreground",
  Good: "bg-blue-500/15 text-blue-500",
  Great: "bg-emerald-500/15 text-emerald-500",
  Advanced: "bg-purple-500/15 text-purple-500",
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toneFor(projected: number, limit: number): "success" | "warning" | "destructive" | undefined {
  if (limit <= 0) return undefined;
  if (projected > limit) return "destructive";
  if (projected > limit * 0.9) return "warning";
  return "success";
}

function toneClass(t: ReturnType<typeof toneFor>): string {
  if (t === "destructive") return "text-destructive";
  if (t === "warning") return "text-amber-500";
  if (t === "success") return "text-emerald-500";
  return "text-foreground";
}

export function ForecastEngine({
  spending,
  recurringEntries,
  monthStart,
  today,
  monthlyLimit,
  totalMonth,
  daysElapsed,
  daysRemaining,
  daysInMonth,
  lastMonthTotal,
}: ForecastEngineProps) {
  const monthsOfData = useMemo(() => countMonthsOfData(spending), [spending]);

  const unlocked = useMemo(
    () => FORECAST_MODELS.filter((m) => monthsOfData >= m.requiredMonths),
    [monthsOfData],
  );
  const lockedCount = FORECAST_MODELS.length - unlocked.length;

  const [activeModelId, setActiveModelId] = useState<ForecastModel["id"]>("linear");
  useEffect(() => {
    const best = [...unlocked].sort((a, b) => b.requiredMonths - a.requiredMonths)[0];
    if (best) setActiveModelId(best.id);
  }, [unlocked.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeModel = FORECAST_MODELS.find((m) => m.id === activeModelId)!;

  const linear = useMemo(
    () => linearForecast(totalMonth, daysElapsed, daysInMonth, lastMonthTotal),
    [totalMonth, daysElapsed, daysInMonth, lastMonthTotal],
  );
  const fixedVar = useMemo(
    () => fixedVariableForecast(totalMonth, daysElapsed, daysRemaining, daysInMonth, recurringEntries, spending, today),
    [totalMonth, daysElapsed, daysRemaining, daysInMonth, recurringEntries, spending, today],
  );
  const dayWeighted = useMemo(
    () => dayWeightedForecast(spending, today, daysInMonth, monthStart),
    [spending, today, daysInMonth, monthStart],
  );
  const monte = useMemo(
    () => monteCarloForecast(spending, today, daysInMonth, monthStart),
    [spending, today, daysInMonth, monthStart],
  );
  const probUnderBudget = useMemo(() => {
    if (monthlyLimit <= 0) return 0;
    return (monte.results.filter((r) => r <= monthlyLimit).length / Math.max(1, monte.results.length)) * 100;
  }, [monte.results, monthlyLimit]);

  const todayDow = new Date(today + "T12:00:00").getDay();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Spending Forecast</h3>
        <span className="text-xs text-muted-foreground">
          {monthsOfData} month{monthsOfData !== 1 ? "s" : ""} of data
        </span>
      </div>

      {/* Model selector */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {FORECAST_MODELS.map((m) => {
          const isUnlocked = monthsOfData >= m.requiredMonths;
          const isActive = m.id === activeModelId;
          const base = "flex-shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition flex flex-col items-start gap-1 min-w-[140px]";
          const cls = !isUnlocked
            ? "bg-muted/50 border border-border/50 text-muted-foreground cursor-not-allowed opacity-60"
            : isActive
              ? "bg-gradient-primary text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-muted";
          return (
            <button
              key={m.id}
              type="button"
              disabled={!isUnlocked}
              onClick={() => isUnlocked && setActiveModelId(m.id)}
              className={`${base} ${cls}`}
            >
              <div className="flex items-center gap-1.5">
                {!isUnlocked && <Lock className="h-3 w-3" />}
                <span>{m.name}</span>
                <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${ACCURACY_BADGE[m.accuracy]}`}>
                  {m.accuracy}
                </span>
              </div>
              {!isUnlocked && (
                <span className="text-[10px]">Unlocks at {m.requiredMonths} months</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation box */}
      <div className="mt-3 rounded-xl border border-border/50 bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{activeModel.name}</div>
          <span className={`rounded px-2 py-0.5 text-[10px] ${ACCURACY_BADGE[activeModel.accuracy]}`}>
            {activeModel.accuracy}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activeModel.explanation}</p>
      </div>

      {/* Results */}
      <div className="mt-4">
        {activeModelId === "linear" && (
          <div>
            <div className={`font-display text-3xl font-bold ${toneClass(toneFor(linear.projected, monthlyLimit))}`}>
              {fmtMoney(linear.projected)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Method: {linear.method}</div>
            {monthlyLimit > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-primary"
                  style={{ width: `${Math.min(100, (linear.projected / monthlyLimit) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {activeModelId === "fixed_variable" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Fixed costs remaining</div>
              <div className="mt-1 font-display text-xl font-semibold">{fmtMoney(fixedVar.fixedRemaining)}</div>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Variable projected</div>
              <div className="mt-1 font-display text-xl font-semibold">{fmtMoney(fixedVar.variableProjected)}</div>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">Total projected</div>
              <div className={`mt-1 font-display text-xl font-semibold ${toneClass(toneFor(fixedVar.projected, monthlyLimit))}`}>
                {fmtMoney(fixedVar.projected)}
              </div>
            </div>
          </div>
        )}

        {activeModelId === "day_weighted" && (
          <div>
            <div className={`font-display text-3xl font-bold ${toneClass(toneFor(dayWeighted.projected, monthlyLimit))}`}>
              {fmtMoney(dayWeighted.projected)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Method: {dayWeighted.method}</div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {DOW_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`rounded p-2 text-[10px] ${i === todayDow ? "bg-gradient-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground"}`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-0.5 text-xs">{fmtMoney(dayWeighted.weights[i] ?? 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeModelId === "monte_carlo" && (
          monthlyLimit > 0 ? (
            <div>
              <div className="relative">
                <div className="mb-1 text-center text-xs text-muted-foreground">
                  Median: <span className="font-medium text-foreground">{fmtMoney(monte.projected)}</span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-500/40 via-amber-500/40 to-destructive/40">
                  {(() => {
                    const range = Math.max(1, monte.p90 - monte.p10);
                    const pos = Math.max(0, Math.min(100, ((monte.projected - monte.p10) / range) * 100));
                    return <div className="absolute top-0 h-full w-1 bg-foreground" style={{ left: `${pos}%` }} />;
                  })()}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>p10: {fmtMoney(monte.p10)}</span>
                  <span>p90: {fmtMoney(monte.p90)}</span>
                </div>
              </div>
              <div
                className={`mt-4 text-lg font-semibold ${
                  probUnderBudget > 60 ? "text-emerald-500" : probUnderBudget >= 40 ? "text-amber-500" : "text-destructive"
                }`}
              >
                {probUnderBudget.toFixed(0)}% chance of finishing under budget
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Best case (p10)</div>
                  <div className="mt-1 font-display text-lg font-semibold">{fmtMoney(monte.p10)}</div>
                </div>
                <div className="rounded-xl bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Likely (median)</div>
                  <div className="mt-1 font-display text-lg font-semibold">{fmtMoney(monte.projected)}</div>
                </div>
                <div className="rounded-xl bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Worst case (p90)</div>
                  <div className="mt-1 font-display text-lg font-semibold">{fmtMoney(monte.p90)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Set a monthly budget to see probability analysis</div>
          )
        )}
      </div>

      {lockedCount > 0 && (
        <div className="mt-4 text-xs text-muted-foreground">
          🔒 {lockedCount} more model{lockedCount > 1 ? "s" : ""} unlock as you track more months
        </div>
      )}
    </div>
  );
}
