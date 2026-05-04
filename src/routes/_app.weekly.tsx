import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useAccounts, useMembers } from "@/lib/data-hooks";
import { useHousehold } from "@/lib/household-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABELS, fmtMoney, weekEnding } from "@/lib/finance";
import { toast } from "sonner";
import { Save, TrendingDown, TrendingUp, Minus } from "lucide-react";

export const Route = createFileRoute("/_app/weekly")({
  component: () => (<RequireHousehold><WeeklyPage /></RequireHousehold>),
});

function WeeklyPage() {
  const { active } = useHousehold();
  const { data: accounts } = useAccounts();
  const { data: members } = useMembers();
  const [week, setWeek] = useState(weekEnding());
  const [values, setValues] = useState<Record<string, string>>({});
  const [previous, setPrevious] = useState<Record<string, { balance: number; week_ending: string }>>({});
  const [saving, setSaving] = useState(false);

  // Load this week's values + previous-week comparison
  useEffect(() => {
    (async () => {
      if (!active) return;
      const [{ data: thisWeek }, { data: prior }] = await Promise.all([
        supabase.from("weekly_snapshots").select("account_id,balance")
          .eq("household_id", active.id).eq("week_ending", week),
        supabase.from("weekly_snapshots").select("account_id,balance,week_ending")
          .eq("household_id", active.id).lt("week_ending", week)
          .order("week_ending", { ascending: false }),
      ]);
      const next: Record<string, string> = {};
      for (const a of accounts) {
        const found = (thisWeek ?? []).find((s: any) => s.account_id === a.id);
        next[a.id] = found ? String(found.balance) : "";
      }
      setValues(next);

      const prevMap: Record<string, { balance: number; week_ending: string }> = {};
      for (const row of (prior ?? []) as any[]) {
        if (!prevMap[row.account_id]) {
          prevMap[row.account_id] = { balance: Number(row.balance), week_ending: row.week_ending };
        }
      }
      setPrevious(prevMap);
    })();
  }, [week, active?.id, accounts]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof accounts>();
    for (const a of accounts) {
      const key = a.member_id || "joint";
      const arr = map.get(key) ?? [];
      arr.push(a); map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [accounts]);

  const save = async () => {
    if (!active) return;
    setSaving(true);
    const rows = accounts
      .filter((a) => values[a.id] !== undefined && values[a.id] !== "")
      .map((a) => ({
        household_id: active.id,
        account_id: a.id,
        week_ending: week,
        balance: Number(values[a.id]),
      }));
    if (rows.length === 0) { setSaving(false); return toast.error("Enter at least one balance"); }
    const { error } = await supabase.from("weekly_snapshots").upsert(rows, { onConflict: "account_id,week_ending" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Saved ${rows.length} balances for week ending ${week}`);
  };

  const totalThisWeek = useMemo(
    () => accounts.reduce((s, a) => s + (Number(values[a.id]) || 0) * (a.include_in_net_worth ? 1 : 0), 0),
    [accounts, values]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Weekly Entry</h1>
          <p className="text-sm text-muted-foreground">Just drop in this week's balance for each account.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5"><Label>Week ending</Label><Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} /></div>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary shadow-glow"><Save className="mr-1 h-4 w-4" />{saving ? "Saving…" : "Save week"}</Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Add at least one account first.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([memberId, accts]) => (
            <div key={memberId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-sm font-medium">
                {memberId === "joint" ? "Joint accounts" : members.find((m) => m.id === memberId)?.name ?? "Unassigned"}
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Account</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 w-40">Current Balance</th>
                    <th className="px-4 py-2 w-56">vs. Last Week</th>
                  </tr>
                </thead>
                <tbody>
                  {accts.map((a) => {
                    const v = values[a.id] ?? "";
                    const prev = previous[a.id];
                    const current = Number(v);
                    const hasCurrent = v !== "" && !Number.isNaN(current);
                    const diff = hasCurrent && prev ? current - prev.balance : null;
                    return (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{a.name}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{CATEGORY_LABELS[a.category]}</td>
                        <td className="px-4 py-2">
                          <Input
                            inputMode="decimal"
                            value={v}
                            onChange={(e) => setValues((s) => ({ ...s, [a.id]: e.target.value }))}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {prev ? (
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Last: {fmtMoney(prev.balance)}</span>
                              {diff !== null && (
                                <span className={`inline-flex items-center gap-1 font-medium ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                  {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {diff > 0 ? "+" : ""}{fmtMoney(diff)} this week
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No prior entry</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <div className="flex justify-end text-sm text-muted-foreground">
            Net (entered): <span className="ml-2 font-display text-lg font-bold text-foreground">{fmtMoney(totalThisWeek)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
