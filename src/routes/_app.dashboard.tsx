import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { StatCard } from "@/components/StatCard";
import { useAccounts, useLatestBalances, useMembers, useSnapshots } from "@/lib/data-hooks";
import { CASH_CATEGORIES, INVESTMENT_CATEGORIES, RETIREMENT_CATEGORIES, fmtMoney, isAsset, isLiability, pctChange } from "@/lib/finance";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Minus, Flame, ArrowRight } from "lucide-react";
import { useHousehold } from "@/lib/household-context";
import { useProfile } from "@/lib/profile-context";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import { todayInTz } from "@/lib/tz";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const isFixedEntry = (s: { notes: string | null }) =>
  s.notes?.startsWith("[FIXED]") ?? false;

const isCreditEntry = (s: { notes: string | null }) =>
  s.notes?.startsWith("[CREDIT]") ?? false;

export const Route = createFileRoute("/_app/dashboard")({
  component: () => (<RequireHousehold><DashboardPage /></RequireHousehold>),
});

function DashboardPage() {
  const { data: members } = useMembers();
  const { data: accounts } = useAccounts();
  const { data: snapshots } = useSnapshots();
  const [tab, setTab] = useState("combined");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your household money at a glance.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="combined">Combined</TabsTrigger>
          {members.map((m) => (<TabsTrigger key={m.id} value={m.id}>{m.name}</TabsTrigger>))}
        </TabsList>

        <TabsContent value="combined" className="mt-6">
          <DashboardView accounts={accounts} snapshots={snapshots} />
        </TabsContent>
        {members.map((m) => (
          <TabsContent key={m.id} value={m.id} className="mt-6">
            <DashboardView
              accounts={accounts.filter((a) => a.member_id === m.id || a.ownership === "joint")}
              snapshots={snapshots}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function DashboardView({ accounts, snapshots }: { accounts: ReturnType<typeof useAccounts>["data"]; snapshots: ReturnType<typeof useSnapshots>["data"] }) {
  const balances = useLatestBalances(accounts, snapshots);
  const accountIds = new Set(accounts.map((a) => a.id));
  const filteredSnaps = useMemo(() => snapshots.filter((s) => accountIds.has(s.account_id)), [snapshots, accountIds]);

  const sumBy = (catFilter: (c: string) => boolean, key: "current" | "previous", absolute = false) => accounts
    .filter((a) => catFilter(a.category) && a.include_in_net_worth)
    .reduce((sum, a) => {
      const v = balances.get(a.id)?.[key] ?? 0;
      return sum + (absolute ? Math.abs(v) : v);
    }, 0);

  const cash = sumBy((c) => CASH_CATEGORIES.includes(c as any), "current");
  const invest = sumBy((c) => INVESTMENT_CATEGORIES.includes(c as any), "current");
  const retire = sumBy((c) => RETIREMENT_CATEGORIES.includes(c as any), "current");
  const debt = sumBy((c) => isLiability(c as any), "current", true);
  const assets = sumBy((c) => isAsset(c as any), "current");
  const liabs = sumBy((c) => isLiability(c as any), "current", true);
  const net = assets - liabs;

  const prevAssets = sumBy((c) => isAsset(c as any), "previous");
  const prevLiabs = sumBy((c) => isLiability(c as any), "previous", true);
  const prevNet = prevAssets - prevLiabs;
  const weeklyChange = net - prevNet;

  // Build net worth series
  const series = useMemo(() => {
    const weeks = Array.from(new Set(filteredSnaps.map((s) => s.week_ending))).sort();
    return weeks.map((w) => {
      let a = 0, l = 0;
      for (const acct of accounts) {
        if (!acct.include_in_net_worth) continue;
        const upTo = filteredSnaps.filter((s) => s.account_id === acct.id && s.week_ending <= w);
        const last = upTo[upTo.length - 1];
        if (!last) continue;
        if (isAsset(acct.category)) a += last.balance;
        else if (isLiability(acct.category)) l += Math.abs(last.balance);
      }
      return { week: w.slice(5), net: a - l, assets: a, liabilities: l };
    });
  }, [filteredSnaps, accounts]);

  // monthly change: latest week vs same period last month
  const monthlyChange = useMemo(() => {
    if (series.length < 2) return 0;
    const last = series[series.length - 1];
    // Find a snapshot ~4 weeks earlier
    const target = series[Math.max(0, series.length - 5)];
    return last.net - target.net;
  }, [series]);

  const ChangeBadge = ({ v }: { v: number }) => (
    <span className={`inline-flex items-center gap-1 text-xs ${v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground"}`}>
      {v > 0 ? <TrendingUp className="h-3 w-3" /> : v < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {fmtMoney(Math.abs(v))} {prevNet ? `(${pctChange(net, prevNet).toFixed(1)}%)` : ""}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net Worth" value={fmtMoney(net)} sub={<ChangeBadge v={weeklyChange} />} tone={net >= 0 ? "success" : "destructive"} />
        <StatCard label="Total Assets" value={fmtMoney(assets)} />
        <StatCard label="Total Liabilities" value={fmtMoney(liabs)} tone={liabs > 0 ? "warning" : "default"} />
        <StatCard label="Monthly Change" value={fmtMoney(monthlyChange)} tone={monthlyChange >= 0 ? "success" : "destructive"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cash" value={fmtMoney(cash)} />
        <StatCard label="Investments" value={fmtMoney(invest)} />
        <StatCard label="Retirement" value={fmtMoney(retire)} />
        <StatCard label="Debt" value={fmtMoney(debt)} tone={debt > 0 ? "warning" : "default"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-semibold">Net worth over time</h3>
        {series.length === 0 ? (
          <div className="grid h-64 place-items-center text-sm text-muted-foreground">Add a weekly entry to see your trend.</div>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.22 277)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="oklch(0.62 0.22 277)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.05 280)" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="oklch(0.7 0.04 270)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.04 270)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.18 0.05 280)", border: "1px solid oklch(0.28 0.05 280)", borderRadius: 8 }}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Area type="monotone" dataKey="net" stroke="oklch(0.62 0.22 277)" strokeWidth={2} fill="url(#nw)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <DailyBudgetSummary />
      <GoalsSection net={net} assets={assets} debt={debt} />
    </div>
  );
}

type Goal = {
  id: string;
  household_id: string;
  label: string;
  type: "net_worth" | "savings" | "debt_payoff";
  target: number;
  created_at: string;
};

function GoalsSection({ net, assets, debt }: { net: number; assets: number; debt: number }) {
  const { active } = useHousehold();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<Goal["type"]>("net_worth");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const loadGoals = async () => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("household_goals" as any)
      .select("*")
      .eq("household_id", active.id)
      .order("created_at");
    if (!error && data) {
      setGoals(
        (data as any[]).map((g) => ({
          ...g,
          target: Number(g.target),
        })) as Goal[]
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const addGoal = async () => {
    if (!label.trim() || !target || !active) return;
    setSaving(true);
    const { error } = await supabase
      .from("household_goals" as any)
      .insert({
        household_id: active.id,
        label: label.trim(),
        type,
        target: Number(target),
      } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Goal added");
    setLabel(""); setTarget(""); setType("net_worth"); setOpen(false);
    loadGoals();
  };

  const removeGoal = async (id: string) => {
    const { error } = await supabase
      .from("household_goals" as any)
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Goal removed");
    loadGoals();
  };

  const currentFor = (t: Goal["type"]) =>
    t === "net_worth" ? net : t === "savings" ? assets : debt;

  if (!active) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Goals</h3>
        <GoalDialog
          open={open}
          onOpenChange={setOpen}
          label={label}
          setLabel={setLabel}
          type={type}
          setType={setType}
          target={target}
          setTarget={setTarget}
          onAdd={addGoal}
          saving={saving}
        />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Set a net worth, savings, or debt payoff goal to track your progress.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {goals.map((g) => {
            const current = currentFor(g.type);
            const pct = g.target > 0 ? Math.min(100, (current / g.target) * 100) : 0;
            const reached = current >= g.target;
            const typeLabel =
              g.type === "net_worth" ? "Net worth"
              : g.type === "savings" ? "Savings"
              : "Debt payoff";
            return (
              <div key={g.id} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">
                    {g.label}
                    {reached && (
                      <span className="ml-2 rounded bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success">
                        🎯 Goal reached!
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="text-muted-foreground hover:text-destructive text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {typeLabel}
                  </span>
                  <span>{fmtMoney(current)} of {fmtMoney(g.target)}</span>
                  <span className="ml-auto">{Math.round(pct)}%</span>
                </div>
                <Progress value={pct} className="mt-2 h-2" indicatorClassName={reached ? "bg-success" : "bg-gradient-primary"} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalDialog({
  open, onOpenChange, label, setLabel, type, setType,
  target, setTarget, onAdd, saving,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  label: string; setLabel: (v: string) => void;
  type: Goal["type"]; setType: (v: Goal["type"]) => void;
  target: string; setTarget: (v: string) => void;
  onAdd: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="text-xs text-primary hover:underline">+ Add goal</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. $500k net worth" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Goal["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="net_worth">Net worth</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="debt_payoff">Debt payoff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Target amount ($)</Label>
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="500000" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onAdd} disabled={saving} className="bg-gradient-primary">
            {saving ? "Saving…" : "Add goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DailyBudgetSummary() {
  const { active } = useHousehold();
  const { profile } = useProfile();
  const tz = profile?.user_timezone || "UTC";
  const today = todayInTz(tz);
  const [limit, setLimit] = useState(0);
  const [entries, setEntries] = useState<Array<{ amount: number; spent_at: string; spent_local_date: string | null; notes: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!active) return;
      setLoading(true);
      const [budgetsRes, entriesRes] = await Promise.all([
        supabase.from("budgets").select("daily_limit,budget_type,period,is_active").eq("household_id", active.id),
        supabase.from("spending_entries").select("amount,spent_at,spent_local_date,notes").eq("household_id", active.id),
      ]);
      if (cancelled) return;
      const b = (budgetsRes.data ?? []).find((x: any) => x.budget_type === "combined" && x.period === "daily" && x.is_active);
      setLimit(b ? Number(b.daily_limit) : 0);
      setEntries((entriesRes.data ?? []).map((e: any) => ({
        amount: Number(e.amount),
        spent_at: e.spent_at,
        spent_local_date: e.spent_local_date,
        notes: e.notes,
      })));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [active?.id, today]);

  if (!active) return null;

  // Compute week + month starts (Sunday-based week to match defaults)
  const todayD = new Date(today + "T00:00:00");
  const dow = todayD.getUTCDay();
  const wkStartD = new Date(todayD); wkStartD.setUTCDate(todayD.getUTCDate() - dow);
  const weekStart = wkStartD.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  const variableDailyLimit = limit;
  const variableWeeklyLimit = variableDailyLimit * 7;
  const variableMonthlyLimit = variableDailyLimit * 31;

  const variableEntries = entries.filter((e) => !isFixedEntry(e));
  const fixedEntries = entries.filter((e) => isFixedEntry(e));
  const creditEntries = entries.filter((e) => isCreditEntry(e));
  const pureVariableEntries = variableEntries.filter((e) => !isCreditEntry(e));
  const dateOf = (e: typeof entries[number]) => e.spent_local_date || e.spent_at;

  const totalVariableToday = pureVariableEntries.filter((e) => dateOf(e) === today).reduce((s, e) => s + e.amount, 0);
  const totalVariableWeek = pureVariableEntries.filter((e) => dateOf(e) >= weekStart && dateOf(e) <= today).reduce((s, e) => s + e.amount, 0);
  const totalVariableMonth = pureVariableEntries.filter((e) => dateOf(e) >= monthStart && dateOf(e) <= today).reduce((s, e) => s + e.amount, 0);
  const totalFixedMonth = fixedEntries.filter((e) => dateOf(e) >= monthStart && dateOf(e) <= today).reduce((s, e) => s + e.amount, 0);
  const fixedCountMonth = fixedEntries.filter((e) => dateOf(e) >= monthStart && dateOf(e) <= today).length;
  const totalCreditsMonth = creditEntries.filter((e) => dateOf(e) >= monthStart && dateOf(e) <= today).reduce((s, e) => s + e.amount, 0);
  const creditsCountMonth = creditEntries.filter((e) => dateOf(e) >= monthStart && dateOf(e) <= today).length;

  const rows = [
    { label: "Today", spent: totalVariableToday, limit: variableDailyLimit },
    { label: "This week", spent: totalVariableWeek, limit: variableWeeklyLimit },
    { label: "This month", spent: totalVariableMonth, limit: variableMonthlyLimit },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-warning" />
          <h3 className="font-display text-sm font-semibold">Budget overview</h3>
        </div>
        <Link to="/budget" className="flex items-center gap-1 text-sm text-primary hover:underline">
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {loading ? (
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      ) : variableDailyLimit === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          No daily budget set — <Link to="/budget" className="text-primary">add one</Link>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {rows.map(({ label, spent, limit: lim }) => {
              const pct = lim ? Math.min(100, (spent / lim) * 100) : 0;
              const remaining = lim - spent;
              const over = remaining < 0;
              const tone = over ? "destructive" : pct >= 80 ? "warning" : "success";
              const barColor = tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success";
              const textColor = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-success";
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{fmtMoney(spent)} of {fmtMoney(lim)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={`mt-0.5 text-[11px] font-medium ${textColor}`}>
                    {over ? `Over by ${fmtMoney(Math.abs(remaining))}` : `${fmtMoney(remaining)} left`}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border my-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fixed</span>
              <span className="text-sm text-muted-foreground">{fixedCountMonth} logged this month</span>
            </div>
            <span className="text-sm font-medium">{fmtMoney(totalFixedMonth)}</span>
          </div>
          {creditsCountMonth > 0 && (
            <>
              <div className="border-t border-border my-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success border border-success/20">
                    Credits
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {creditsCountMonth} {creditsCountMonth === 1 ? "return" : "returns"} this month
                  </span>
                </div>
                <span className="text-sm font-medium text-success">
                  +{fmtMoney(totalCreditsMonth)}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
