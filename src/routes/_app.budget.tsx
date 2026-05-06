import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useHousehold } from "@/lib/household-context";
import { useMembers } from "@/lib/data-hooks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { fmtMoney, fmtMoneyExact, SPENDING_CATEGORIES } from "@/lib/finance";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useProfile } from "@/lib/profile-context";
import { todayInTz, startOfWeekInTz, startOfMonthInTz } from "@/lib/tz";


export const Route = createFileRoute("/_app/budget")({
  component: () => (<RequireHousehold><BudgetPage /></RequireHousehold>),
});

type Period = "daily" | "weekly" | "monthly";
type BudgetType = "individual" | "combined";

interface Budget {
  id: string; name: string; budget_type: BudgetType; period: Period;
  member_id: string | null; daily_limit: number; is_active: boolean;
}
interface Spending {
  id: string; member_id: string | null; amount: number; category: string;
  payment_method: string | null; notes: string | null; spent_at: string;
  spent_local_date?: string | null;
}

function BudgetPage() {
  const { active } = useHousehold();
  const { data: members } = useMembers();
  const { profile } = useProfile();
  const tz = profile?.user_timezone || "UTC";
  const weekStartDay = profile?.week_start || "sunday";
  const today = todayInTz(tz);
  const weekStart = startOfWeekInTz(tz, weekStartDay);
  const monthStart = startOfMonthInTz(tz);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spending, setSpending] = useState<Spending[]>([]);
  const [openBudget, setOpenBudget] = useState(false);
  const [openSpend, setOpenSpend] = useState(false);

  const loadAll = async () => {
    if (!active) return;
    const [b, s] = await Promise.all([
      supabase.from("budgets").select("*").eq("household_id", active.id).order("created_at"),
      supabase.from("spending_entries").select("*").eq("household_id", active.id).order("spent_at", { ascending: false }),
    ]);
    setBudgets((b.data ?? []).map((r: any) => ({ ...r, daily_limit: Number(r.daily_limit), period: r.period ?? "daily" })) as Budget[]);
    setSpending((s.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as Spending[]);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [active?.id]);

  // ----- Budget form -----
  const [bName, setBName] = useState("");
  const [bType, setBType] = useState<"individual" | "combined" | "both">("combined");
  const [bPeriod, setBPeriod] = useState<Period>("daily");
  const [bMember, setBMember] = useState("");
  const [bLimit, setBLimit] = useState("");
  const addBudget = async () => {
    if (!active || !bName.trim() || !bLimit) return;
    const limit = Number(bLimit);
    const rows: any[] = [];
    if (bType === "combined" || bType === "both") {
      rows.push({ household_id: active.id, name: bName.trim(), budget_type: "combined", period: bPeriod, member_id: null, daily_limit: limit });
    }
    if (bType === "individual" || bType === "both") {
      const m = bMember || (members[0]?.id ?? null);
      if (!m) return toast.error("Add a household member first");
      rows.push({ household_id: active.id, name: bName.trim(), budget_type: "individual", period: bPeriod, member_id: m, daily_limit: limit });
    }
    const { error } = await supabase.from("budgets").insert(rows);
    if (error) return toast.error(error.message);
    setBName(""); setBLimit(""); setBMember(""); setOpenBudget(false); loadAll();
    toast.success("Budget created");
  };

  // ----- Spending form -----
  const [sAmount, setSAmount] = useState("");
  const [sMember, setSMember] = useState("");
  const [sCategory, setSCategory] = useState<string>("food");
  const [sNotes, setSNotes] = useState("");
  const [sDate, setSDate] = useState(today);
  useEffect(() => { setSDate(today); }, [today]);
  const addSpend = async () => {
    if (!active || !sAmount) return;
    const { error } = await supabase.from("spending_entries").insert({
      household_id: active.id, amount: Number(sAmount), member_id: sMember || null,
      category: sCategory as any, notes: sNotes || null,
      spent_at: sDate, spent_local_date: sDate, user_timezone: tz,
    } as any);
    if (error) return toast.error(error.message);
    setSAmount(""); setSNotes(""); setOpenSpend(false); loadAll();
    toast.success("Spending logged");
  };

  const removeSpend = async (id: string) => {
    await supabase.from("spending_entries").delete().eq("id", id);
    loadAll();
  };

  // Use spent_local_date when available, fallback to spent_at
  const localDate = (s: Spending) => s.spent_local_date || s.spent_at;

  const sumWindow = (start: string, memberFilter?: string | null) =>
    spending
      .filter((s) => localDate(s) >= start && localDate(s) <= today)
      .filter((s) => memberFilter === undefined ? true : s.member_id === memberFilter)
      .reduce((sum, x) => sum + x.amount, 0);

  const totalToday = sumWindow(today);
  const totalWeek = sumWindow(weekStart);
  const totalMonth = sumWindow(monthStart);

  // Find combined budgets per period
  const combinedDaily = budgets.find((b) => b.budget_type === "combined" && b.period === "daily" && b.is_active);
  const combinedWeekly = budgets.find((b) => b.budget_type === "combined" && b.period === "weekly" && b.is_active);
  const combinedMonthly = budgets.find((b) => b.budget_type === "combined" && b.period === "monthly" && b.is_active);

  const hasCombined = !!(combinedDaily || combinedWeekly || combinedMonthly);
  const individualBudgets = budgets.filter((b) => b.budget_type === "individual" && b.is_active);
  const hasIndividual = individualBudgets.length > 0;

  // Mode for card visibility
  const mode: "combined" | "individual" | "both" | "none" =
    hasCombined && hasIndividual ? "both" :
    hasCombined ? "combined" :
    hasIndividual ? "individual" : "none";

  const showCombinedCards = mode === "combined" || mode === "both" || mode === "none";
  const showIndividualCards = mode === "individual" || mode === "both";

  // Per period daily-equivalent budgets
  const dailyLimit = combinedDaily?.daily_limit ?? 0;
  const weeklyLimit = combinedWeekly?.daily_limit ?? 0;
  const monthlyLimit = combinedMonthly?.daily_limit ?? 0;

  const cardData = (label: string, spent: number, limit: number) => {
    const remaining = limit - spent;
    const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
    const tone: "success" | "warning" | "destructive" | "default" =
      !limit ? "default" :
      remaining < 0 ? "destructive" :
      pct >= 80 ? "warning" : "success";
    return { label, spent, limit, remaining, pct, tone };
  };

  const dCard = cardData("Today", totalToday, dailyLimit);
  const wCard = cardData("This week", totalWeek, weeklyLimit);
  const mCard = cardData("This month", totalMonth, monthlyLimit);

  // Status banner
  const status = useMemo(() => {
    if (!hasCombined && !hasIndividual) return { msg: "Set a budget to start tracking.", tone: "default" as const, emoji: "✨" };
    // Pick worst-offending period
    const cards = [dCard, wCard, mCard].filter((c) => c.limit > 0);
    if (cards.length === 0) return { msg: "Add a daily, weekly, or monthly limit.", tone: "default" as const, emoji: "✨" };
    const over = cards.find((c) => c.remaining < 0);
    if (over) return { msg: `Overspent by ${fmtMoney(Math.abs(over.remaining))} ${over.label.toLowerCase()}.`, tone: "destructive" as const, emoji: "🚨" };
    const close = cards.find((c) => c.pct >= 80);
    if (close) return { msg: `Careful — close to ${close.label.toLowerCase()} limit.`, tone: "warning" as const, emoji: "⚠️" };
    const best = cards[0];
    return { msg: `You saved ${fmtMoney(best.remaining)} ${best.label.toLowerCase()} so far!`, tone: "success" as const, emoji: "💸" };
  }, [hasCombined, hasIndividual, dCard, wCard, mCard]);

  // Per-member today (only when individual or both mode)
  const perMember = members.map((m) => {
    const ib = individualBudgets.find((b) => b.member_id === m.id);
    const limit = ib?.daily_limit ?? 0;
    const period = ib?.period ?? "daily";
    const start = period === "monthly" ? monthStart : period === "weekly" ? weekStart : today;
    const spent = sumWindow(start, m.id);
    const remaining = limit - spent;
    return { member: m, limit, period, spent, remaining, hasBudget: !!ib };
  }).filter(() => showIndividualCards);

  // Trends
  const last7 = useMemo(() => {
    const days: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = spending.filter((s) => localDate(s) === iso).reduce((s, x) => s + x.amount, 0);
      days.push({ day: iso.slice(5), total });
    }
    return days;
  }, [spending]);

  // Category breakdown last 30 days
  const catBreakdown = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const map = new Map<string, number>();
    for (const s of spending) {
      if (localDate(s) < cutoffIso) continue;
      map.set(s.category, (map.get(s.category) ?? 0) + s.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, label: SPENDING_CATEGORIES.find((c) => c.value === k)?.label ?? k, value: v }));
  }, [spending]);
  const catMax = Math.max(1, ...catBreakdown.map((c) => c.value));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Daily Budget</h1>
          <p className="text-sm text-muted-foreground">Stay on track day · week · month.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openBudget} onOpenChange={setOpenBudget}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" />Budget</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New budget</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="e.g. Daily essentials" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Type</Label>
                    <Select value={bType} onValueChange={(v) => setBType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="combined">Combined household</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="both">Both (combined + individual)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Period</Label>
                    <Select value={bPeriod} onValueChange={(v) => setBPeriod(v as Period)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Limit ($)</Label><Input inputMode="decimal" value={bLimit} onChange={(e) => setBLimit(e.target.value)} placeholder="100" /></div>
                {(bType === "individual" || bType === "both") && (
                  <div className="space-y-1.5"><Label>Member</Label>
                    <Select value={bMember} onValueChange={setBMember}>
                      <SelectTrigger><SelectValue placeholder="Pick member" /></SelectTrigger>
                      <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={addBudget} className="bg-gradient-primary">Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openSpend} onOpenChange={setOpenSpend}>
            <DialogTrigger asChild><Button className="bg-gradient-primary shadow-glow"><Plus className="mr-1 h-4 w-4" />Log spend</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log spending</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount ($)</Label><Input inputMode="decimal" value={sAmount} onChange={(e) => setSAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Member</Label>
                    <Select value={sMember || "none"} onValueChange={(v) => setSMember(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Household</SelectItem>
                        {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Category</Label>
                    <Select value={sCategory} onValueChange={setSCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SPENDING_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Input value={sNotes} onChange={(e) => setSNotes(e.target.value)} placeholder="optional" /></div>
              </div>
              <DialogFooter><Button onClick={addSpend} className="bg-gradient-primary">Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-3 rounded-2xl border p-4 shadow-card transition-colors
        ${status.tone === "success" ? "border-success/40 bg-success/10" :
          status.tone === "warning" ? "border-warning/40 bg-warning/10" :
          status.tone === "destructive" ? "border-destructive/40 bg-destructive/10" :
          "border-border bg-card"}`}>
        <span className="text-2xl">{status.emoji}</span>
        <div className="font-medium">{status.msg}</div>
      </div>

      {/* Combined period stats */}
      {showCombinedCards && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Spent today" value={fmtMoney(totalToday)} icon={<Flame className="h-4 w-4 text-warning" />} />
            <PeriodCard data={dCard} />
            <StatCard label="Spent this week" value={fmtMoney(totalWeek)} />
            <PeriodCard data={wCard} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Spent this month" value={fmtMoney(totalMonth)} />
            <PeriodCard data={mCard} />
            <StatCard
              label="Budget health"
              value={
                status.tone === "success" ? "Healthy" :
                status.tone === "warning" ? "Watch out" :
                status.tone === "destructive" ? "Over budget" : "Set a budget"
              }
              tone={status.tone === "default" ? "default" : status.tone}
            />
            <StatCard label="Last 7 days" value={fmtMoney(last7.reduce((s, d) => s + d.total, 0))} />
          </div>

          {/* Health bars */}
          {(dailyLimit || weeklyLimit || monthlyLimit) > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {dailyLimit > 0 && <HealthBar title="Daily" data={dCard} />}
              {weeklyLimit > 0 && <HealthBar title="Weekly" data={wCard} />}
              {monthlyLimit > 0 && <HealthBar title="Monthly" data={mCard} />}
            </div>
          )}
        </>
      )}

      {/* Per-member */}
      {showIndividualCards && perMember.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {perMember.map(({ member, limit, period, spent, remaining, hasBudget }) => {
            const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
            const tone = !limit ? "default" : remaining < 0 ? "destructive" : pct >= 80 ? "warning" : "success";
            return (
              <div key={member.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary font-display font-bold">{member.name[0]?.toUpperCase()}</div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{member.name} · {period}</div>
                    <div className="font-display text-xl font-bold">{fmtMoney(spent)}{hasBudget && <span className="ml-1 text-xs font-normal text-muted-foreground">of {fmtMoney(limit)}</span>}</div>
                  </div>
                </div>
                {hasBudget && (
                  <>
                    <Progress value={pct} className="mt-3" />
                    <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                      tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {remaining >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {remaining >= 0 ? `${fmtMoney(remaining)} left` : `Over by ${fmtMoney(Math.abs(remaining))}`}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-semibold">Last 7 days</h3>
          <div className="mt-4 space-y-2">
            {last7.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <div className="w-12 text-xs text-muted-foreground">{d.day}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-primary transition-all" style={{ width: `${Math.min(100, dailyLimit ? (d.total / dailyLimit) * 100 : (d.total / Math.max(1, Math.max(...last7.map((x) => x.total)))) * 100)}%` }} />
                </div>
                <div className="w-20 text-right text-sm font-medium">{fmtMoney(d.total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-semibold">By category (30d)</h3>
          <div className="mt-4 space-y-2">
            {catBreakdown.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nothing logged yet.</div>}
            {catBreakdown.map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-28 truncate text-xs text-muted-foreground">{c.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-primary transition-all" style={{ width: `${(c.value / catMax) * 100}%` }} />
                </div>
                <div className="w-20 text-right text-sm font-medium">{fmtMoney(c.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-semibold">Recent spending</h3>
        <div className="mt-3 max-h-80 space-y-2 overflow-auto">
          {spending.slice(0, 30).map((s) => {
            const cat = SPENDING_CATEGORIES.find((c) => c.value === s.category)?.label ?? s.category;
            const m = members.find((m) => m.id === s.member_id);
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{fmtMoneyExact(s.amount)} <span className="text-xs text-muted-foreground">· {cat}</span></div>
                  <div className="text-xs text-muted-foreground">{s.spent_at} · {m?.name ?? "Household"}{s.notes ? ` · ${s.notes}` : ""}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeSpend(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          {spending.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No spending yet. <Sparkles className="ml-1 inline h-3 w-3" /></div>}
        </div>
      </div>
    </div>
  );
}

interface CardData { label: string; spent: number; limit: number; remaining: number; pct: number; tone: "success" | "warning" | "destructive" | "default" }

function PeriodCard({ data }: { data: CardData }) {
  return (
    <StatCard
      label={`Remaining ${data.label.toLowerCase()}`}
      value={data.limit ? fmtMoney(Math.max(0, data.remaining)) : "—"}
      tone={data.tone}
      sub={data.limit ? (data.remaining < 0 ? `Over by ${fmtMoney(Math.abs(data.remaining))}` : `of ${fmtMoney(data.limit)}`) : "no budget set"}
    />
  );
}

function HealthBar({ title, data }: { title: string; data: CardData }) {
  const color = data.tone === "destructive" ? "bg-destructive" : data.tone === "warning" ? "bg-warning" : "bg-success";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex justify-between text-sm">
        <span>{title} health</span>
        <span className="font-medium">{Math.round(data.pct)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all ${color}`} style={{ width: `${Math.min(100, data.pct)}%` }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {fmtMoney(data.spent)} of {fmtMoney(data.limit)} · {data.remaining >= 0 ? `${fmtMoney(data.remaining)} left` : `Over by ${fmtMoney(Math.abs(data.remaining))}`}
      </div>
    </div>
  );
}
