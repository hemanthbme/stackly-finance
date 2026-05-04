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
import { Plus, Trash2, Sparkles, Flame } from "lucide-react";
import { StatCard } from "@/components/StatCard";

export const Route = createFileRoute("/_app/budget")({
  component: () => (<RequireHousehold><BudgetPage /></RequireHousehold>),
});

interface Budget { id: string; name: string; budget_type: "individual" | "combined"; member_id: string | null; daily_limit: number; is_active: boolean; start_date: string; end_date: string | null }
interface Spending { id: string; member_id: string | null; amount: number; category: string; payment_method: string | null; notes: string | null; spent_at: string }

function todayIso() { return new Date().toISOString().slice(0, 10); }

function BudgetPage() {
  const { active } = useHousehold();
  const { data: members } = useMembers();
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
    setBudgets((b.data ?? []).map((r: any) => ({ ...r, daily_limit: Number(r.daily_limit) })) as Budget[]);
    setSpending((s.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as Spending[]);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [active?.id]);

  // Budget form
  const [bName, setBName] = useState("");
  const [bType, setBType] = useState<"individual" | "combined">("combined");
  const [bMember, setBMember] = useState("");
  const [bLimit, setBLimit] = useState("");
  const addBudget = async () => {
    if (!active || !bName.trim() || !bLimit) return;
    const { error } = await supabase.from("budgets").insert({
      household_id: active.id, name: bName.trim(), budget_type: bType,
      member_id: bType === "individual" ? bMember || null : null,
      daily_limit: Number(bLimit),
    });
    if (error) return toast.error(error.message);
    setBName(""); setBLimit(""); setBMember(""); setOpenBudget(false); loadAll();
    toast.success("Budget created");
  };

  // Spending form
  const [sAmount, setSAmount] = useState("");
  const [sMember, setSMember] = useState("");
  const [sCategory, setSCategory] = useState<string>("food");
  const [sNotes, setSNotes] = useState("");
  const [sDate, setSDate] = useState(todayIso());
  const addSpend = async () => {
    if (!active || !sAmount) return;
    const { error } = await supabase.from("spending_entries").insert({
      household_id: active.id, amount: Number(sAmount), member_id: sMember || null,
      category: sCategory as any, notes: sNotes || null, spent_at: sDate,
    });
    if (error) return toast.error(error.message);
    setSAmount(""); setSNotes(""); setOpenSpend(false); loadAll();
    toast.success("Spending logged");
  };

  const removeSpend = async (id: string) => {
    await supabase.from("spending_entries").delete().eq("id", id);
    loadAll();
  };

  const today = todayIso();
  const todaySpend = useMemo(() => spending.filter((s) => s.spent_at === today), [spending, today]);
  const totalToday = todaySpend.reduce((s, x) => s + x.amount, 0);

  const combinedBudget = budgets.find((b) => b.budget_type === "combined" && b.is_active);
  const limit = combinedBudget?.daily_limit ?? 0;
  const remaining = limit - totalToday;
  const pct = limit ? Math.min(100, (totalToday / limit) * 100) : 0;

  const status =
    !limit ? { msg: "Set a combined daily budget to start tracking.", tone: "default" as const, emoji: "✨" }
    : remaining < 0 ? { msg: "Over budget today, let's reset tomorrow.", tone: "destructive" as const, emoji: "🚨" }
    : pct >= 80 ? { msg: "Careful, you're close to your daily limit.", tone: "warning" as const, emoji: "⚠️" }
    : { msg: "You're doing great today!", tone: "success" as const, emoji: "💸" };

  // Per-member today
  const perMember = members.map((m) => ({
    member: m, total: todaySpend.filter((s) => s.member_id === m.id).reduce((s, x) => s + x.amount, 0),
  }));

  // Trends
  const last7 = useMemo(() => {
    const days: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const total = spending.filter((s) => s.spent_at === iso).reduce((s, x) => s + x.amount, 0);
      days.push({ day: iso.slice(5), total });
    }
    return days;
  }, [spending]);

  const last30Total = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    return spending.filter((s) => new Date(s.spent_at) >= cutoff).reduce((sum, s) => sum + s.amount, 0);
  }, [spending]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Daily Budget</h1>
          <p className="text-sm text-muted-foreground">Stay on track day-by-day.</p>
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
                      <SelectContent><SelectItem value="combined">Combined</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Daily limit ($)</Label><Input inputMode="decimal" value={bLimit} onChange={(e) => setBLimit(e.target.value)} placeholder="50" /></div>
                </div>
                {bType === "individual" && (
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
      <div className={`flex items-center gap-3 rounded-2xl border p-4 shadow-card
        ${status.tone === "success" ? "border-success/40 bg-success/10" :
          status.tone === "warning" ? "border-warning/40 bg-warning/10" :
          status.tone === "destructive" ? "border-destructive/40 bg-destructive/10" :
          "border-border bg-card"}`}>
        <span className="text-2xl">{status.emoji}</span>
        <div className="font-medium">{status.msg}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Spent today" value={fmtMoney(totalToday)} icon={<Flame className="h-4 w-4 text-warning" />} />
        <StatCard label="Remaining today" value={fmtMoney(Math.max(0, remaining))} tone={remaining < 0 ? "destructive" : remaining < limit * 0.2 ? "warning" : "success"} sub={limit ? `of ${fmtMoney(limit)}` : "no budget set"} />
        <StatCard label="Last 7 days" value={fmtMoney(last7.reduce((s, d) => s + d.total, 0))} />
        <StatCard label="Last 30 days" value={fmtMoney(last30Total)} />
      </div>

      {limit > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex justify-between text-sm">
            <span>Daily budget used</span>
            <span className="font-medium">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="mt-2" />
        </div>
      )}

      {perMember.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {perMember.map(({ member, total }) => (
            <div key={member.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary font-display font-bold">{member.name[0]?.toUpperCase()}</div>
                <div>
                  <div className="text-xs text-muted-foreground">{member.name} today</div>
                  <div className="font-display text-xl font-bold">{fmtMoney(total)}</div>
                </div>
              </div>
            </div>
          ))}
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
                  <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, limit ? (d.total / limit) * 100 : (d.total / Math.max(1, Math.max(...last7.map((x) => x.total)))) * 100)}%` }} />
                </div>
                <div className="w-20 text-right text-sm font-medium">{fmtMoney(d.total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-semibold">Recent spending</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {spending.slice(0, 20).map((s) => {
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
    </div>
  );
}
