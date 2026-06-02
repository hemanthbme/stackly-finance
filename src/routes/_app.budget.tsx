import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useHousehold } from "@/lib/household-context";
import { useMembers, useAccounts } from "@/lib/data-hooks";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtMoney, fmtMoneyExact, SPENDING_CATEGORIES } from "@/lib/finance";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, Flame, TrendingDown, TrendingUp, Pencil, Save, X, Tag } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ForecastEngine } from "@/components/ForecastEngine";
import { useProfile } from "@/lib/profile-context";
import { todayInTz, startOfWeekInTz, startOfMonthInTz } from "@/lib/tz";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Label as RechartsLabel,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";

const PIE_COLORS = [
  "oklch(0.62 0.22 277)",
  "oklch(0.74 0.17 160)",
  "oklch(0.72 0.21 55)",
  "oklch(0.65 0.24 20)",
  "oklch(0.70 0.18 220)",
  "oklch(0.68 0.20 310)",
  "oklch(0.76 0.15 100)",
  "oklch(0.60 0.22 0)",
];

const CHART_TOOLTIP_STYLE = {
  background: "oklch(0.18 0.05 280)",
  border: "1px solid oklch(0.28 0.05 280)",
  borderRadius: 8,
};

export const Route = createFileRoute("/_app/budget")({
  component: () => (<RequireHousehold><BudgetPage /></RequireHousehold>),
});

const isFixedEntry = (s: { notes: string | null }) =>
  s.notes?.startsWith("[FIXED]") ?? false;

const stripFixedPrefix = (notes: string | null) =>
  notes?.replace(/^\[FIXED\]\s*/, "") ?? "";

const isCreditEntry = (s: { notes: string | null }) =>
  s.notes?.startsWith("[CREDIT]") ?? false;

const stripCreditPrefix = (notes: string | null) =>
  notes?.replace(/^\[CREDIT\]\s*/, "") ?? "";

const CREDIT_CATEGORIES = [
  { value: "return_amazon", label: "Amazon / Online Return" },
  { value: "return_store", label: "Store Return" },
  { value: "reimbursement", label: "Work Reimbursement" },
  { value: "cash_gift", label: "Cash Gift Received" },
  { value: "sold_item", label: "Sold Item (Facebook, eBay, etc.)" },
  { value: "cashback", label: "Cashback / Rewards" },
  { value: "other_credit", label: "Other Credit" },
];

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
interface CustomCategory {
  id: string; name: string; icon: string | null; color: string | null;
  category_type: "expense" | "income"; is_active: boolean;
}
type RecurringEntry = { id: string; label: string; amount: number; category: string; memberId: string };


function BudgetPage() {
  const { active } = useHousehold();
  const { data: members } = useMembers();
  const { data: accounts } = useAccounts();
  const { profile } = useProfile();
  const tz = profile?.user_timezone || "UTC";
  const weekStartDay = profile?.week_start || "sunday";
  const today = todayInTz(tz);
  const weekStart = startOfWeekInTz(tz, weekStartDay);
  const monthStart = startOfMonthInTz(tz);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spending, setSpending] = useState<Spending[]>([]);
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [openBudget, setOpenBudget] = useState(false);
  const [openSpend, setOpenSpend] = useState(false);
  const [openCat, setOpenCat] = useState(false);
  const [openRecurring, setOpenRecurring] = useState(false);
  const [recurring, setRecurring] = useState<RecurringEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("stackly:recurring") || "[]"); } catch { return []; }
  });
  const persistRecurring = (list: RecurringEntry[]) => {
    setRecurring(list);
    if (typeof window !== "undefined") localStorage.setItem("stackly:recurring", JSON.stringify(list));
  };
  const [rLabel, setRLabel] = useState("");
  const [rAmount, setRAmount] = useState("");
  const [rCategory, setRCategory] = useState("food");
  const [rMember, setRMember] = useState("");
  const addRecurring = () => {
    if (!rLabel.trim() || !rAmount) return;
    persistRecurring([...recurring, { id: crypto.randomUUID(), label: rLabel.trim(), amount: Number(rAmount), category: rCategory, memberId: rMember }]);
    setRLabel(""); setRAmount(""); setRCategory("food"); setRMember("");
  };
  const removeRecurring = (id: string) => persistRecurring(recurring.filter((r) => r.id !== id));
  const logRecurring = async (r: RecurringEntry) => {
    if (!active) return;
    const isCustom = r.category.startsWith("custom:");
    const dbCat = isCustom ? "other" : r.category;
    const labelPrefix = isCustom ? `[${categoryLabel(r.category)}]` : "";
    const notesValue = [labelPrefix, r.label].filter(Boolean).join(" ").trim() || null;
    const { error } = await supabase.from("spending_entries").insert({
      household_id: active.id, amount: r.amount, member_id: r.memberId || null,
      category: dbCat as any, notes: notesValue,
      payment_method: null,
      spent_at: today, spent_local_date: today, user_timezone: tz,
    } as any);
    if (error) return toast.error(error.message);
    loadAll();
    toast.success("Logged: " + r.label);
  };

  const loadAll = async () => {
    if (!active) return;
    const [b, s, c] = await Promise.all([
      supabase.from("budgets").select("*").eq("household_id", active.id).order("created_at"),
      supabase.from("spending_entries").select("*").eq("household_id", active.id).order("spent_at", { ascending: false }),
      supabase.from("transaction_categories" as any).select("*").eq("household_id", active.id).order("name"),
    ]);
    setBudgets((b.data ?? []).map((r: any) => ({ ...r, daily_limit: Number(r.daily_limit), period: r.period ?? "daily" })) as Budget[]);
    setSpending((s.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as Spending[]);
    setCategories(((c.data ?? []) as unknown) as CustomCategory[]);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [active?.id]);

  // ----- merged categories (built-in + custom active) -----
  const allCategories = useMemo(() => {
    const builtIn = SPENDING_CATEGORIES.map((c) => ({ value: c.value, label: c.label, color: null as string | null }));
    const custom = categories.filter((c) => c.is_active && c.category_type === "expense").map((c) => ({ value: `custom:${c.id}`, label: c.name, color: c.color }));
    return [...builtIn, ...custom];
  }, [categories]);

  const categoryLabel = (v: string) => allCategories.find((c) => c.value === v)?.label ?? v;

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
  const [sPayment, setSPayment] = useState("");
  const [sDate, setSDate] = useState(today);
  const [sIsFixed, setSIsFixed] = useState(false);
  const [sIsCredit, setSIsCredit] = useState(false);
  const [sCreditCategory, setSCreditCategory] = useState("return_amazon");
  useEffect(() => { setSDate(today); }, [today]);
  useEffect(() => {
    if (!openSpend) {
      setSIsFixed(false);
      setSIsCredit(false);
      setSCreditCategory("return_amazon");
    }
  }, [openSpend]);
  const addSpend = async () => {
    if (!active || !sAmount) return;
    const resolvedPaymentMethod = sPayment
      ? (paymentMethodOptions.find((p) => p.value === sPayment)?.label ?? sPayment)
      : null;
    if (sIsCredit) {
      const creditLabel = CREDIT_CATEGORIES.find((c) => c.value === sCreditCategory)?.label ?? sCreditCategory;
      const notesValue = [`[CREDIT] ${creditLabel}`, sNotes].filter(Boolean).join(" — ").trim() || `[CREDIT] ${creditLabel}`;
      const { error } = await supabase.from("spending_entries").insert({
        household_id: active.id,
        amount: Math.abs(Number(sAmount)),
        member_id: sMember || null,
        category: "other" as any,
        notes: notesValue,
        payment_method: resolvedPaymentMethod,
        spent_at: sDate,
        spent_local_date: sDate,
        user_timezone: tz,
      } as any);
      if (error) return toast.error(error.message);
      setSAmount(""); setSNotes(""); setSPayment(""); setSIsCredit(false); setOpenSpend(false); loadAll();
      toast.success("Credit logged");
      return;
    }
    // Custom categories use the "other" enum + store real name in notes prefix
    const isCustom = sCategory.startsWith("custom:");
    const dbCat = isCustom ? "other" : sCategory;
    const labelPrefix = isCustom ? `[${categoryLabel(sCategory)}]` : "";
    const fixedPrefix = sIsFixed ? "[FIXED] " : "";
    const notesValue = [fixedPrefix + labelPrefix, sNotes].filter(Boolean).join(" ").trim() || null;
    const { error } = await supabase.from("spending_entries").insert({
      household_id: active.id, amount: Number(sAmount), member_id: sMember || null,
      category: dbCat as any, notes: notesValue,
      payment_method: resolvedPaymentMethod,
      spent_at: sDate, spent_local_date: sDate, user_timezone: tz,
    } as any);
    if (error) return toast.error(error.message);
    setSAmount(""); setSNotes(""); setSPayment(""); setSIsFixed(false); setOpenSpend(false); loadAll();
    toast.success("Spending logged");
  };

  const removeSpend = async (id: string) => {
    await supabase.from("spending_entries").delete().eq("id", id);
    loadAll();
  };

  // ----- Edit spending -----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Spending> & { payment_method?: string | null }>({});
  const startEdit = (s: Spending) => {
    setEditingId(s.id);
    setEditDraft({ ...s });
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };
  const saveEdit = async () => {
    if (!editingId) return;
    const patch: any = {
      amount: Number(editDraft.amount),
      category: editDraft.category as any,
      member_id: editDraft.member_id || null,
      notes: editDraft.notes || null,
      payment_method: editDraft.payment_method || null,
      spent_at: editDraft.spent_at,
      spent_local_date: editDraft.spent_at,
      user_timezone: tz,
    };
    const { error } = await supabase.from("spending_entries").update(patch).eq("id", editingId);
    if (error) return toast.error(error.message);
    cancelEdit(); loadAll();
    toast.success("Updated");
  };

  // ----- Custom category form -----
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("");
  const [catColor, setCatColor] = useState("#4f46e5");
  const [catType, setCatType] = useState<"expense" | "income">("expense");
  const addCategory = async () => {
    if (!active || !catName.trim()) return;
    const { data, error } = await supabase.from("transaction_categories" as any).insert({
      household_id: active.id, name: catName.trim(), icon: catIcon || null,
      color: catColor, category_type: catType, is_active: true,
    } as any).select().single();
    if (error) return toast.error(error.message);
    setCatName(""); setCatIcon(""); setOpenCat(false); loadAll();
    if (data && (data as any).id) setSCategory("custom:" + (data as any).id);
    toast.success("Category added");
  };
  const toggleCategory = async (c: CustomCategory) => {
    await supabase.from("transaction_categories" as any).update({ is_active: !c.is_active } as any).eq("id", c.id);
    loadAll();
  };
  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("transaction_categories" as any).delete().eq("id", id);
    loadAll();
  };

  // ----- Aggregations -----
  const localDate = (s: Spending) => s.spent_local_date || s.spent_at;

  const variableSpending = spending.filter((s) => !isFixedEntry(s));
  const fixedSpending = spending.filter((s) => isFixedEntry(s));
  const creditSpending = spending.filter((s) => isCreditEntry(s));
  const pureVariableSpending = variableSpending.filter((s) => !isCreditEntry(s));

  const sumWindowFiltered = (entries: typeof spending, start: string, memberFilter?: string | null) =>
    entries
      .filter((s) => {
        const d = localDate(s);
        return d >= start && d <= today;
      })
      .filter((s) => memberFilter === undefined ? true : s.member_id === memberFilter)
      .reduce((sum, x) => sum + x.amount, 0);

  const sumWindow = (start: string, memberFilter?: string | null) =>
    sumWindowFiltered(pureVariableSpending, start, memberFilter);

  const totalVariableToday = sumWindowFiltered(pureVariableSpending, today);
  const totalVariableWeek = sumWindowFiltered(pureVariableSpending, weekStart);
  const totalVariableMonth = sumWindowFiltered(pureVariableSpending, monthStart);
  const totalFixedToday = sumWindowFiltered(fixedSpending, today);
  const totalFixedWeek = sumWindowFiltered(fixedSpending, weekStart);
  const totalFixedMonth = sumWindowFiltered(fixedSpending, monthStart);
  const totalCreditsToday = sumWindowFiltered(creditSpending, today);
  const totalCreditsWeek = sumWindowFiltered(creditSpending, weekStart);
  const totalCreditsMonth = sumWindowFiltered(creditSpending, monthStart);
  const creditsCountMonth = creditSpending.filter((s) => {
    const d = s.spent_local_date || s.spent_at;
    return d >= monthStart && d <= today;
  }).length;
  // Back-compat aliases (downstream projection/charts use variable totals)
  const totalToday = totalVariableToday;
  const totalWeek = totalVariableWeek;
  const totalMonth = totalVariableMonth;
  void totalFixedToday; void totalFixedWeek; void totalCreditsWeek;

  const combinedDaily = budgets.find((b) => b.budget_type === "combined" && b.period === "daily" && b.is_active);

  const hasCombined = !!combinedDaily;
  const individualBudgets = budgets.filter((b) => b.budget_type === "individual" && b.is_active);
  const hasIndividual = individualBudgets.length > 0;

  const mode: "combined" | "individual" | "both" | "none" =
    hasCombined && hasIndividual ? "both" :
    hasCombined ? "combined" :
    hasIndividual ? "individual" : "none";

  const showCombinedCards = mode === "combined" || mode === "both" || mode === "none";
  const showIndividualCards = mode === "individual" || mode === "both";

  // Single variable daily rate — weekly and monthly roll up from this
  const variableDailyLimit = combinedDaily?.daily_limit ?? 0;
  const variableWeeklyLimit = variableDailyLimit * 7;
  const variableMonthlyLimit = variableDailyLimit * 31;

  const dailyLimit = variableDailyLimit;
  const weeklyLimit = variableWeeklyLimit;
  const monthlyLimit = variableMonthlyLimit;

  const cardData = (label: string, spent: number, limit: number) => {
    const remaining = limit - spent;
    const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
    const tone: "success" | "warning" | "destructive" | "default" =
      !limit ? "default" :
      remaining < 0 ? "destructive" :
      pct >= 80 ? "warning" : "success";
    return { label, spent, limit, remaining, pct, tone };
  };

  const dCard = cardData("Today (variable)", totalVariableToday, variableDailyLimit);
  const wCard = cardData("This week (variable)", totalVariableWeek, variableWeeklyLimit);
  const mCard = cardData("This month (variable)", totalVariableMonth, variableMonthlyLimit);

  // ----- Monthly projection -----
  const projection = useMemo(() => {
    const [yy, mm] = monthStart.split("-").map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const [, , dd] = today.split("-").map(Number);
    const daysElapsed = Math.max(1, dd);
    const avgDaily = totalMonth / daysElapsed;
    const projectedSpend = avgDaily * daysInMonth;
    const projectedResult = monthlyLimit - projectedSpend;
    const daysRemaining = daysInMonth - dd;
    return {
      daysInMonth, daysElapsed, daysRemaining,
      avgDaily, projectedSpend, projectedResult,
      onTrack: monthlyLimit > 0 ? projectedResult >= 0 : null,
    };
  }, [monthStart, today, totalMonth, monthlyLimit]);

  const lastMonthTotal = useMemo(() => {
    const [yy, mm] = monthStart.split("-").map(Number);
    const prevMonthStart = mm === 1
      ? `${yy - 1}-12-01`
      : `${yy}-${String(mm - 1).padStart(2, "0")}-01`;
    const prevMonthEnd = `${yy}-${String(mm).padStart(2, "0")}-01`;
    return spending
      .filter((s) => {
        const d = s.spent_local_date || s.spent_at;
        return d >= prevMonthStart && d < prevMonthEnd;
      })
      .reduce((sum, s) => sum + s.amount, 0);
  }, [spending, monthStart]);

  // Projection chart data (full month)
  const projectionChart = useMemo(() => {
    const [yy, mm] = monthStart.split("-").map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    // cumulative actual per day
    const days: { day: number; date: string; actual: number | null; projected: number | null; budget: number | null }[] = [];
    let runTotal = 0;
    const [, , td] = today.split("-").map(Number);
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayTotal = spending.filter((s) => localDate(s) === iso).reduce((s, x) => s + x.amount, 0);
      runTotal += dayTotal;
      const isPast = i <= td;
      days.push({
        day: i, date: iso,
        actual: isPast ? runTotal : null,
        projected: projection.avgDaily * i,
        budget: monthlyLimit ? (monthlyLimit / daysInMonth) * i : null,
      });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spending, monthStart, today, monthlyLimit, projection.avgDaily]);

  const chartMax = Math.max(
    monthlyLimit,
    ...projectionChart.map((p) => Math.max(p.actual ?? 0, p.projected ?? 0))
  ) || 1;

  // ----- Weekly pace -----
  const daysElapsedThisWeek = Math.max(1, Math.round((new Date(today).getTime() - new Date(weekStart).getTime()) / 86400000) + 1);
  const expectedWeekSpend = weeklyLimit > 0 ? (weeklyLimit / 7) * daysElapsedThisWeek : 0;
  const weeklyPaceStatus: "on_track" | "slightly_ahead" | "overpacing" =
    weeklyLimit === 0 ? "on_track"
    : totalWeek > expectedWeekSpend * 1.2 ? "overpacing"
    : totalWeek > expectedWeekSpend * 1.05 ? "slightly_ahead"
    : "on_track";

  // ----- Status -----
  const status = useMemo(() => {
    const recoveryPerDayWeekly = Math.max(0, (weeklyLimit - totalWeek)) / Math.max(1, 7 - daysElapsedThisWeek);
    const recoveryPerDayMonthly = Math.max(0, (monthlyLimit - totalMonth)) / Math.max(1, projection.daysRemaining);

    if (dCard.limit > 0 && dCard.remaining < 0) {
      return { msg: `Over by ${fmtMoney(Math.abs(dCard.remaining))} today — resets tomorrow`, tone: "destructive" as const, emoji: "🔴" };
    }
    if (wCard.limit > 0 && wCard.remaining < 0) {
      return { msg: `Over weekly limit by ${fmtMoney(Math.abs(wCard.remaining))} — spend at most ${fmtMoney(recoveryPerDayWeekly)}/day to recover`, tone: "destructive" as const, emoji: "🔴" };
    }
    if (mCard.limit > 0 && mCard.remaining < 0) {
      return { msg: `Over monthly limit by ${fmtMoney(Math.abs(mCard.remaining))} — spend at most ${fmtMoney(recoveryPerDayMonthly)}/day to recover`, tone: "destructive" as const, emoji: "🔴" };
    }
    const close = [dCard, wCard, mCard].find((c) => c.limit > 0 && c.pct >= 80);
    if (close) {
      return { msg: `Getting close to your ${close.label.toLowerCase()} limit — ${fmtMoney(close.remaining)} left`, tone: "warning" as const, emoji: "🟡" };
    }
    if (weeklyPaceStatus === "overpacing") {
      return { msg: "Spending faster than usual this week — watch your pace", tone: "warning" as const, emoji: "🟡" };
    }
    const anyLimit = dCard.limit > 0 || wCard.limit > 0 || mCard.limit > 0;
    if (anyLimit) {
      const remaining = dCard.limit > 0 ? dCard.remaining : wCard.limit > 0 ? wCard.remaining : mCard.remaining;
      const scope = dCard.limit > 0 ? "today" : wCard.limit > 0 ? "this week" : "this month";
      return { msg: `On track — ${fmtMoney(remaining)} left ${scope}`, tone: "success" as const, emoji: "🟢" };
    }
    return { msg: "Set a budget to start tracking.", tone: "default" as const, emoji: "✨" };
  }, [dCard, wCard, mCard, weeklyLimit, monthlyLimit, totalWeek, totalMonth, daysElapsedThisWeek, projection.daysRemaining, weeklyPaceStatus]);


  const perMember = members.map((m) => {
    const ib = individualBudgets.find((b) => b.member_id === m.id);
    const limit = ib?.daily_limit ?? 0;
    const period = ib?.period ?? "daily";
    const start = period === "monthly" ? monthStart : period === "weekly" ? weekStart : today;
    const spent = sumWindow(start, m.id);
    const remaining = limit - spent;
    return { member: m, limit, period, spent, remaining, hasBudget: !!ib };
  }).filter(() => showIndividualCards);

  // Daily totals across the WHOLE current month
  const monthDaily = useMemo(() => {
    const [yy, mm] = monthStart.split("-").map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const arr: { iso: string; label: string; total: number }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const total = spending.filter((s) => localDate(s) === iso).reduce((s, x) => s + x.amount, 0);
      arr.push({ iso, label: iso.slice(5), total });
    }
    return arr;
  }, [spending, monthStart]);

  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of pureVariableSpending) {
      const d = s.spent_local_date || s.spent_at;
      if (d < monthStart || d > today) continue;
      map.set(s.category, (map.get(s.category) ?? 0) + s.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        key: k,
        label: allCategories.find((c) => c.value === k)?.label ?? k,
        value: v,
      }));
  }, [pureVariableSpending, monthStart, today, allCategories]);
  const catMax = Math.max(1, ...catBreakdown.map((c) => c.value));

  const PAYMENT_ACCOUNT_CATEGORIES = ["checking", "savings", "credit_card"];
  const paymentMethodOptions = useMemo(() => {
    return accounts
      .filter((a) => PAYMENT_ACCOUNT_CATEGORIES.includes(a.category) && a.is_active)
      .map((a) => ({
        value: a.id,
        label: a.institution ? `${a.name} — ${a.institution}` : a.name,
        category: a.category,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Daily Budget</h1>
          <p className="text-sm text-muted-foreground">Stay on track day · week · month.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={openCat} onOpenChange={setOpenCat}>
            <DialogTrigger asChild><Button variant="outline"><Tag className="mr-1 h-4 w-4" />Category</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Subscriptions" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Icon (emoji)</Label><Input value={catIcon} onChange={(e) => setCatIcon(e.target.value)} placeholder="🎬" maxLength={4} /></div>
                  <div className="space-y-1.5"><Label>Color</Label><Input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Type</Label>
                  <Select value={catType} onValueChange={(v) => setCatType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={addCategory} className="bg-gradient-primary">Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>

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

          <Dialog open={openRecurring} onOpenChange={setOpenRecurring}>
            <DialogTrigger asChild><Button variant="outline">Recurring</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Recurring entries</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {recurring.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No recurring entries yet.</div>
                ) : (
                  <div className="space-y-2">
                    {recurring.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2">
                        <div>
                          <div className="text-sm font-medium">{r.label} <span className="text-xs text-muted-foreground">· {fmtMoneyExact(r.amount)}</span></div>
                          <div className="text-xs text-muted-foreground">{categoryLabel(r.category)}{r.memberId ? " · " + (members.find((m) => m.id === r.memberId)?.name ?? "") : ""}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => logRecurring(r)}>Log now</Button>
                          <Button size="sm" variant="ghost" onClick={() => removeRecurring(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Add new</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={rLabel} onChange={(e) => setRLabel(e.target.value)} placeholder="Netflix" /></div>
                    <div className="space-y-1"><Label className="text-xs">Amount</Label><Input inputMode="decimal" value={rAmount} onChange={(e) => setRAmount(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Category</Label>
                      <Select value={rCategory} onValueChange={setRCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{allCategories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Member</Label>
                      <Select value={rMember || "none"} onValueChange={(v) => setRMember(v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Household</SelectItem>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={addRecurring} className="w-full bg-gradient-primary">Save recurring</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={openSpend} onOpenChange={setOpenSpend}>
            <DialogTrigger asChild><Button className="bg-gradient-primary shadow-glow"><Plus className="mr-1 h-4 w-4" />Log spend</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{sIsCredit ? "Log return or credit" : "Log spending"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div>
                    <Label>Return or credit</Label>
                    <div className="text-xs text-muted-foreground">
                      Money coming back to you — returns, reimbursements, cashback
                    </div>
                  </div>
                  <Switch
                    checked={sIsCredit}
                    onCheckedChange={(v) => {
                      setSIsCredit(v);
                      setSIsFixed(false);
                    }}
                  />
                </div>
                {sIsCredit && (
                  <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-xs text-success font-medium">
                    💚 This will be logged as money received — it won't reduce your daily spending total
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount ($)</Label><Input inputMode="decimal" value={sAmount} onChange={(e) => setSAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} /></div>
                </div>
                {!sIsCredit && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <div>
                      <Label>Fixed expense</Label>
                      <div className="text-xs text-muted-foreground">
                        Fixed costs won't count against your daily variable limit
                      </div>
                    </div>
                    <Switch checked={sIsFixed} onCheckedChange={setSIsFixed} />
                  </div>
                )}
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
                  {sIsCredit ? (
                    <div className="space-y-1.5">
                      <Label>Credit type</Label>
                      <Select value={sCreditCategory} onValueChange={setSCreditCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CREDIT_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Category</Label>
                        <Button variant="ghost" type="button" className="h-auto p-0 text-xs text-primary" onClick={() => { setOpenSpend(false); setOpenCat(true); }}>+ New category</Button>
                      </div>
                      <Select value={sCategory} onValueChange={setSCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{allCategories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.value.startsWith("custom:") && (
                              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.color ?? "#4f46e5", marginRight: 6 }} />
                            )}
                            {c.label}
                          </SelectItem>
                        ))}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Payment method</Label>
                    <Select value={sPayment || "none"} onValueChange={(v) => setSPayment(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not specified —</SelectItem>
                        {paymentMethodOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="inline-flex items-center gap-2">
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {p.category === "credit_card" ? "CC" : p.category === "checking" ? "CHK" : "SAV"}
                              </span>
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {paymentMethodOptions.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Add checking, savings, or credit card accounts to enable payment tracking.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5"><Label>Notes</Label><Input value={sNotes} onChange={(e) => setSNotes(e.target.value)} placeholder="optional" /></div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addSpend} className={sIsCredit ? "bg-success hover:bg-success/90" : "bg-gradient-primary"}>
                  {sIsCredit ? "Log return" : "Add"}
                </Button>
              </DialogFooter>
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="month">Month view</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          {showCombinedCards && (
            <>
              {/* Section A — Variable spending trackers */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Variable spending</h3>
                  {variableDailyLimit > 0 ? (
                    <span className="text-sm text-muted-foreground">{fmtMoney(variableDailyLimit)}/day</span>
                  ) : (
                    <button onClick={() => setOpenBudget(true)} className="text-sm text-primary hover:underline">Set a daily limit</button>
                  )}
                </div>
                <div className="space-y-4 mt-4">
                  {[
                    { label: "Today", spent: totalVariableToday, limit: variableDailyLimit },
                    { label: "This week", spent: totalVariableWeek, limit: variableWeeklyLimit },
                    { label: "This month", spent: totalVariableMonth, limit: variableMonthlyLimit },
                  ].map(({ label, spent, limit }) => {
                    const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
                    const remaining = limit - spent;
                    const over = remaining < 0;
                    const tone = !limit ? "default" : over ? "destructive" : pct >= 80 ? "warning" : "success";
                    const barColor = tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : tone === "success" ? "bg-success" : "bg-muted-foreground";
                    const textColor = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-muted-foreground";
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {fmtMoney(spent)} of {limit ? fmtMoney(limit) : "—"}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className={`mt-1 text-xs font-medium ${textColor}`}>
                          {!limit ? "No limit set" : over ? `Over by ${fmtMoney(Math.abs(remaining))}` : `${fmtMoney(remaining)} left`}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(totalCreditsToday > 0 || totalCreditsWeek > 0 || totalCreditsMonth > 0) && (
                  <div className="border-t border-border pt-3 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Credits & returns</span>
                      <span className="text-success font-medium">+{fmtMoney(totalCreditsMonth)} this month</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      {totalCreditsToday > 0 && <span>Today: +{fmtMoney(totalCreditsToday)}</span>}
                      {totalCreditsWeek > 0 && <span>This week: +{fmtMoney(totalCreditsWeek)}</span>}
                    </div>
                  </div>
                )}
              </div>

              {weeklyLimit > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm shadow-card">
                  <span className="font-medium text-muted-foreground">Weekly pace</span>
                  <span className={`ml-auto font-medium ${weeklyPaceStatus === "on_track" ? "text-success" : weeklyPaceStatus === "slightly_ahead" ? "text-warning" : "text-destructive"}`}>
                    {weeklyPaceStatus === "on_track" ? "✅ On track" : weeklyPaceStatus === "slightly_ahead" ? "⚠️ Slightly ahead of pace" : "🚨 Overpacing this week"}
                  </span>
                </div>
              )}

              {/* Section B — Fixed expenses this month */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Fixed expenses</h3>
                  <span className="text-sm text-muted-foreground">
                    {fixedSpending.filter((s) => (s.spent_local_date || s.spent_at) >= monthStart).length} logged · {fmtMoney(totalFixedMonth)} this month
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {(() => {
                    const monthFixed = fixedSpending
                      .filter((s) => (s.spent_local_date || s.spent_at) >= monthStart)
                      .sort((a, b) => (b.spent_at || "").localeCompare(a.spent_at || ""));
                    if (monthFixed.length === 0) {
                      return <div className="text-sm text-muted-foreground text-center py-6">No fixed expenses logged this month.</div>;
                    }
                    return monthFixed.map((s) => {
                      const strippedNotes = stripFixedPrefix(s.notes);
                      const memberName = members.find((m) => m.id === s.member_id)?.name ?? "Household";
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                          <div>
                            <div className="text-sm font-medium">{categoryLabel(s.category)} · {fmtMoneyExact(s.amount)}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.spent_at} · {memberName}{strippedNotes ? ` · ${strippedNotes}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fixed</span>
                            <Button variant="ghost" size="icon" onClick={() => removeSpend(s.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Section C — Returns & credits this month */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Returns & credits</h3>
                  <span className="text-sm text-success">
                    {creditsCountMonth} logged · +{fmtMoney(totalCreditsMonth)} this month
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {(() => {
                    const monthCredits = creditSpending
                      .filter((s) => (s.spent_local_date || s.spent_at) >= monthStart)
                      .sort((a, b) => (b.spent_at || "").localeCompare(a.spent_at || ""));
                    if (monthCredits.length === 0) {
                      return <div className="text-sm text-muted-foreground text-center py-6">No returns or credits logged this month.</div>;
                    }
                    return monthCredits.map((s) => {
                      const stripped = stripCreditPrefix(s.notes);
                      const parts = stripped.split(" — ");
                      const typeLabel = parts[0] ?? "";
                      const extraNote = parts.slice(1).join(" — ");
                      const memberName = members.find((m) => m.id === s.member_id)?.name ?? "Household";
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                          <div>
                            <div className="text-sm font-medium text-success">
                              +{fmtMoneyExact(s.amount)}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">· {typeLabel}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.spent_at} · {memberName}{extraNote ? ` · ${extraNote}` : ""}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeSpend(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
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
                      <div className="grid h-10 w-10 place-items-center rounded-full font-display font-bold" style={{ background: member.color ?? "#4f46e5" }}>{member.name[0]?.toUpperCase()}</div>
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

          {/* Category breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-display text-lg font-semibold">Spending breakdown (30d)</h3>
            {catBreakdown.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nothing logged yet.</div>
            ) : (
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-medium text-muted-foreground">By category</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={catBreakdown}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {catBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(value) => fmtMoney(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div className="mb-3 text-sm font-medium text-muted-foreground">Top categories</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={catBreakdown.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.05 280)" />
                      <XAxis type="number" fontSize={11} tickFormatter={(v) => fmtMoney(v)} stroke="oklch(0.7 0.04 270)" />
                      <YAxis type="category" dataKey="label" fontSize={11} width={80} stroke="oklch(0.7 0.04 270)" />
                      <RechartsTooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(value) => fmtMoney(Number(value))}
                      />
                      <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]} fill="oklch(0.62 0.22 277)" maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Recent spending with edit */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-display text-lg font-semibold">Recent spending</h3>
            <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto">
              {spending.slice(0, 50).map((s) => {
                const isEdit = editingId === s.id;
                const cat = SPENDING_CATEGORIES.find((c) => c.value === s.category)?.label ?? s.category;
                const m = members.find((m) => m.id === s.member_id);
                if (isEdit) {
                  return (
                    <div key={s.id} className="rounded-lg border border-primary/40 bg-muted/30 p-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1"><Label className="text-xs">Amount</Label>
                          <Input inputMode="decimal" value={String(editDraft.amount ?? "")} onChange={(e) => setEditDraft({ ...editDraft, amount: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Date</Label>
                          <Input type="date" value={(editDraft.spent_at as string) ?? ""} onChange={(e) => setEditDraft({ ...editDraft, spent_at: e.target.value })} />
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Category</Label>
                          <Select value={(editDraft.category as string) ?? "other"} onValueChange={(v) => setEditDraft({ ...editDraft, category: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{SPENDING_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Member</Label>
                          <Select value={(editDraft.member_id as string) || "none"} onValueChange={(v) => setEditDraft({ ...editDraft, member_id: v === "none" ? null : v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Household</SelectItem>
                              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Payment</Label>
                          <Input value={(editDraft.payment_method as string) ?? ""} onChange={(e) => setEditDraft({ ...editDraft, payment_method: e.target.value })} />
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Notes</Label>
                          <Input value={(editDraft.notes as string) ?? ""} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={saveEdit} className="bg-gradient-primary"><Save className="mr-1 h-3 w-3" />Save</Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="mr-1 h-3 w-3" />Cancel</Button>
                      </div>
                    </div>
                  );
                }
                const isCredit = isCreditEntry(s);
                const displayNotes = isCredit ? stripCreditPrefix(s.notes) : stripFixedPrefix(s.notes);
                return (
                  <div key={s.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isCredit ? "border-success/20 bg-success/5" : "border-border bg-muted/20"}`}>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {isCredit ? (
                          <span className="text-success">+{fmtMoneyExact(s.amount)}</span>
                        ) : (
                          <span>{fmtMoneyExact(s.amount)} <span className="text-xs text-muted-foreground">· {cat}</span></span>
                        )}
                        {isCredit ? (
                          <span className="rounded-full bg-success/10 text-success border border-success/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">Credit</span>
                        ) : isFixedEntry(s) && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fixed</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.spent_at} · {m?.name ?? "Household"}{s.payment_method ? ` · ${s.payment_method}` : ""}{displayNotes ? ` · ${displayNotes}` : ""}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeSpend(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
              {spending.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No spending yet. <Sparkles className="ml-1 inline h-3 w-3" /></div>}
            </div>
          </div>
        </TabsContent>

        {/* HEALTH */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <HealthCard title="Daily" data={dCard} />
            <HealthCard title="Weekly" data={wCard} />
            <HealthCard title="Monthly" data={mCard} />
          </div>

          {/* Projection card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Month-end projection</h3>
              <span className="text-xs text-muted-foreground">Day {projection.daysElapsed} of {projection.daysInMonth}</span>
            </div>
            {monthlyLimit > 0 ? (
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Stat label="Avg / day so far" value={fmtMoney(projection.avgDaily)} />
                <Stat label="Projected spend" value={fmtMoney(projection.projectedSpend)} />
                <Stat
                  label={projection.onTrack ? "Projected remaining" : "Projected overspend"}
                  value={fmtMoney(Math.abs(projection.projectedResult))}
                  tone={projection.onTrack ? "success" : "destructive"}
                />
                {projection.daysRemaining > 0 && (() => {
                  const maxPerDay = (monthlyLimit - totalMonth) / projection.daysRemaining;
                  const tone: "success" | "destructive" | undefined =
                    maxPerDay <= 0 ? "destructive" : maxPerDay >= projection.avgDaily ? "success" : undefined;
                  return (
                    <Stat
                      label="Max spend / day to stay on track"
                      value={maxPerDay > 0 ? fmtMoney(maxPerDay) : fmtMoney(0)}
                      tone={tone}
                    />
                  );
                })()}
              </div>

            ) : (
              <div className="mt-3 text-sm text-muted-foreground">Set a monthly budget to see your projection.</div>
            )}

            {/* Projection chart */}
            {monthlyLimit > 0 && (
              <ProjectionChart days={projectionChart} max={chartMax} monthlyLimit={monthlyLimit} />
            )}
          </div>

          <ForecastEngine
            spending={spending}
            recurringEntries={recurring}
            monthStart={monthStart}
            today={today}
            monthlyLimit={monthlyLimit}
            totalMonth={totalMonth}
            daysElapsed={projection.daysElapsed}
            daysRemaining={projection.daysRemaining}
            daysInMonth={projection.daysInMonth}
            lastMonthTotal={lastMonthTotal}
          />

          {/* Messages */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-display text-lg font-semibold">Status</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>{dCard.limit ? (dCard.remaining < 0 ? `🚨 Over your daily limit by ${fmtMoney(Math.abs(dCard.remaining))}.` : dCard.pct >= 80 ? `⚠️ Close to your daily limit (${Math.round(dCard.pct)}%).` : `✅ On track today — ${fmtMoney(dCard.remaining)} left.`) : "No daily limit set."}</li>
              <li>{wCard.limit ? (wCard.remaining < 0 ? `🚨 Over your weekly limit by ${fmtMoney(Math.abs(wCard.remaining))}.` : wCard.pct >= 80 ? `⚠️ You are close to your weekly limit.` : `✅ Comfortable this week — ${fmtMoney(wCard.remaining)} left.`) : "No weekly limit set."}</li>
              <li>{monthlyLimit ? (projection.onTrack ? `✅ At this pace, you will end the month with ${fmtMoney(projection.projectedResult)} unspent.` : `🚨 At this pace, you may overspend by ${fmtMoney(Math.abs(projection.projectedResult))} this month.`) : "No monthly limit set."}</li>
            </ul>
          </div>
        </TabsContent>

        {/* MONTH VIEW */}
        <TabsContent value="month">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">This month — daily spend</h3>
              <span className="text-xs text-muted-foreground">Scroll to see all {monthDaily.length} days</span>
            </div>
            <div className="mt-4 max-h-[24rem] space-y-2 overflow-auto pr-2">
              {monthDaily.map((d) => {
                const over = dailyLimit > 0 && d.total > dailyLimit;
                const pct = dailyLimit ? Math.min(100, (d.total / dailyLimit) * 100) : (d.total / Math.max(1, Math.max(...monthDaily.map((x) => x.total)))) * 100;
                const isToday = d.iso === today;
                return (
                  <div key={d.iso} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isToday ? "bg-primary/10" : ""}`}>
                    <div className="w-14 text-xs text-muted-foreground">{d.label}{isToday && " ·"}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full transition-all ${over ? "bg-destructive" : "bg-gradient-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={`w-20 text-right text-sm font-medium ${over ? "text-destructive" : ""}`}>{fmtMoney(d.total)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Custom categories</h3>
              <Button size="sm" variant="outline" onClick={() => setOpenCat(true)}><Plus className="mr-1 h-3 w-3" />Add</Button>
            </div>
            <div className="mt-4 space-y-2">
              {categories.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No custom categories yet.</div>}
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full text-sm" style={{ background: c.color ?? "#4f46e5" }}>{c.icon ?? "•"}</div>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.category_type} · {c.is_active ? "active" : "inactive"}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => toggleCategory(c)}>{c.is_active ? "Disable" : "Enable"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCategory(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
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

function HealthCard({ title, data }: { title: string; data: CardData }) {
  const color = data.tone === "destructive" ? "bg-destructive" : data.tone === "warning" ? "bg-warning" : "bg-success";
  const status = !data.limit ? "No limit" : data.remaining < 0 ? "Over budget" : data.pct >= 80 ? "Close to limit" : "Under budget";
  const toneText = data.tone === "destructive" ? "text-destructive" : data.tone === "warning" ? "text-warning" : data.tone === "success" ? "text-success" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg font-semibold">{title}</h4>
        <span className={`text-xs font-medium ${toneText}`}>{status}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><div className="text-muted-foreground">Budget</div><div className="font-medium">{data.limit ? fmtMoney(data.limit) : "—"}</div></div>
        <div><div className="text-muted-foreground">Spent</div><div className="font-medium">{fmtMoney(data.spent)}</div></div>
        <div><div className="text-muted-foreground">Left</div><div className={`font-medium ${data.remaining < 0 ? "text-destructive" : ""}`}>{data.limit ? fmtMoney(data.remaining) : "—"}</div></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all ${color}`} style={{ width: `${Math.min(100, data.pct)}%` }} />
      </div>
      <div className="mt-1 text-right text-xs text-muted-foreground">{Math.round(data.pct)}% used</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const t = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${t}`}>{value}</div>
    </div>
  );
}

function ProjectionChart({ days, max, monthlyLimit }: { days: { day: number; actual: number | null; projected: number | null; budget: number | null }[]; max: number; monthlyLimit: number }) {
  const W = 600, H = 180, P = 24;
  const x = (i: number) => P + (i / Math.max(1, days.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - (v / max) * (H - P * 2);

  const actualPath = days
    .filter((d) => d.actual !== null)
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.day - 1)} ${y(d.actual!)}`)
    .join(" ");
  const projPath = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.day - 1)} ${y(d.projected!)}`)
    .join(" ");
  const budgetY = y(monthlyLimit);

  return (
    <div className="mt-5 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        {/* budget line */}
        <line x1={P} x2={W - P} y1={budgetY} y2={budgetY} stroke="hsl(var(--warning))" strokeDasharray="4 4" />
        <text x={W - P} y={budgetY - 4} textAnchor="end" fontSize="10" fill="hsl(var(--warning))">Budget {fmtMoney(monthlyLimit)}</text>

        {/* projected */}
        <path d={projPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeWidth="1.5" />
        {/* actual */}
        <path d={actualPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />

        {/* legend */}
        <g transform={`translate(${P}, ${P - 12})`} fontSize="10" fill="hsl(var(--muted-foreground))">
          <circle cx="4" cy="4" r="3" fill="hsl(var(--primary))" /><text x="12" y="7">Actual</text>
          <circle cx="64" cy="4" r="3" fill="hsl(var(--muted-foreground))" /><text x="72" y="7">Projected</text>
          <circle cx="138" cy="4" r="3" fill="hsl(var(--warning))" /><text x="146" y="7">Budget</text>
        </g>
      </svg>
    </div>
  );
}
