import {
  isLiability,
  CASH_CATEGORIES,
  INVESTMENT_CATEGORIES,
  RETIREMENT_CATEGORIES,
  signedBalance,
  type AccountCategory,
} from "@/lib/finance";
import type { Account, Snapshot } from "@/lib/data-hooks";

export const PROJECTION_MONTHS = 60;
const WEEKS_PER_MONTH = 52 / 12;

export type ScenarioKey = "conservative" | "likely" | "optimistic";

export interface Assumptions {
  /** Annual investment return, percent (e.g. 6 = 6%). Likely scenario. */
  investReturnPct: number;
  /** Annual asset appreciation, percent. Likely scenario. */
  appreciationPct: number;
  /** Monthly cash contribution across checking + savings, dollars. Likely scenario. */
  monthlyCashContribution: number;
}

export interface ScenarioLevers {
  investReturnPct: number;
  appreciationPct: number;
  cashMultiplier: number;
}

/** Conservative / optimistic keep the same relative spread as 3/6/9 and 1/3/5. */
export function scenarioLevers(a: Assumptions): Record<ScenarioKey, ScenarioLevers> {
  return {
    conservative: {
      investReturnPct: a.investReturnPct - 3,
      appreciationPct: a.appreciationPct - 2,
      cashMultiplier: 0.75,
    },
    likely: {
      investReturnPct: a.investReturnPct,
      appreciationPct: a.appreciationPct,
      cashMultiplier: 1,
    },
    optimistic: {
      investReturnPct: a.investReturnPct + 3,
      appreciationPct: a.appreciationPct + 2,
      cashMultiplier: 1.25,
    },
  };
}

/** Least-squares slope of balance vs. snapshot index (one index = one week). */
export function weeklyTrend(points: { balance: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += points[i].balance;
    sxy += i * points[i].balance;
    sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  if (!denom) return 0;
  return (n * sxy - sx * sy) / denom;
}

export interface AccountModel {
  id: string;
  name: string;
  category: AccountCategory;
  current: number;
  monthlyTrend: number;
  /** Avg monthly contribution recorded on snapshots (investments/retirement). */
  monthlyContribution: number;
}

export function buildAccountModels(accounts: Account[], snapshots: Snapshot[]): AccountModel[] {
  const eligible = accounts.filter((a) => a.include_in_net_worth && a.is_active);
  return eligible.map((a) => {
    const rows = snapshots
      .filter((s) => s.account_id === a.id)
      .sort((x, y) => x.week_ending.localeCompare(y.week_ending));
    const current = Math.abs(rows[rows.length - 1]?.balance ?? 0);
    const slope = weeklyTrend(rows.map((r) => ({ balance: Math.abs(r.balance) })));
    const contribAvg = rows.length
      ? rows.reduce((s, r) => s + (r.contribution ?? 0), 0) / rows.length
      : 0;
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      current,
      monthlyTrend: slope * WEEKS_PER_MONTH,
      monthlyContribution: contribAvg * WEEKS_PER_MONTH,
    };
  });
}

const isInvest = (c: AccountCategory) =>
  INVESTMENT_CATEGORIES.includes(c) || RETIREMENT_CATEGORIES.includes(c);
const isCash = (c: AccountCategory) => CASH_CATEGORIES.includes(c);

/** Observed total monthly cash trend across checking + savings. */
export function observedMonthlyCash(models: AccountModel[]): number {
  return models.filter((m) => isCash(m.category)).reduce((s, m) => s + m.monthlyTrend, 0);
}

export interface ScenarioResult {
  /** netWorth[i] for month i (0 = today). */
  netWorth: number[];
  /** Per-account balance at each month (positive magnitudes). */
  payoffMonth: Record<string, number | null>;
}

export function projectScenario(
  models: AccountModel[],
  levers: ScenarioLevers,
  cashTargetMonthly: number,
  months = PROJECTION_MONTHS,
): ScenarioResult {
  const invMonthly = levers.investReturnPct / 100 / 12;
  const appMonthly = levers.appreciationPct / 100 / 12;

  const observedCash = observedMonthlyCash(models);
  const cashAccounts = models.filter((m) => isCash(m.category));
  const cashTotal = cashTargetMonthly * levers.cashMultiplier;
  // Split the target across cash accounts in proportion to their observed trend.
  const cashShare = new Map<string, number>();
  for (const m of cashAccounts) {
    const share =
      Math.abs(observedCash) > 0.01
        ? m.monthlyTrend / observedCash
        : 1 / Math.max(1, cashAccounts.length);
    cashShare.set(m.id, share * cashTotal);
  }

  const bal = new Map<string, number>(models.map((m) => [m.id, m.current]));
  const payoffMonth: Record<string, number | null> = {};
  for (const m of models) if (isLiability(m.category)) payoffMonth[m.id] = null;

  const netWorth: number[] = [];
  const netAt = () =>
    models.reduce((s, m) => s + signedBalance(m.category, bal.get(m.id) ?? 0), 0);

  netWorth.push(netAt());

  for (let month = 1; month <= months; month++) {
    for (const m of models) {
      let b = bal.get(m.id) ?? 0;
      if (isLiability(m.category)) {
        const paydown = -m.monthlyTrend; // positive when debt is shrinking
        b = b - paydown;
        if (b <= 0) {
          b = 0;
          if (payoffMonth[m.id] == null) payoffMonth[m.id] = month;
        } else {
          const cap = m.current * 3;
          if (cap > 0 && b > cap) b = cap;
        }
      } else if (isCash(m.category)) {
        b = Math.max(0, b + (cashShare.get(m.id) ?? 0));
      } else if (isInvest(m.category)) {
        let contrib = m.monthlyContribution;
        if (Math.abs(contrib) < 0.01) contrib = Math.max(0, m.monthlyTrend);
        b = b * (1 + invMonthly) + contrib;
      } else {
        // other_asset — appreciate, ignore the noisy observed trend
        b = b * (1 + appMonthly);
      }
      bal.set(m.id, b);
    }
    netWorth.push(netAt());
  }

  return { netWorth, payoffMonth };
}

export interface ProjectionPoint {
  date: string; // YYYY-MM-DD
  label: string;
  actual?: number;
  likely?: number;
  band?: [number, number];
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + n);
  return x;
}
