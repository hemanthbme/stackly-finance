import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useAccounts, useLatestBalances, useMembers, useSnapshots } from "@/lib/data-hooks";
import { useHousehold } from "@/lib/household-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, fmtMoney, isAsset, isLiability, SPENDING_CATEGORIES } from "@/lib/finance";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  component: () => (<RequireHousehold><ReportsPage /></RequireHousehold>),
});

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name;
  link.click(); URL.revokeObjectURL(url);
  toast.success(`Exported ${name}`);
}

function ReportsPage() {
  const { active } = useHousehold();
  const { data: accounts } = useAccounts();
  const { data: snapshots } = useSnapshots();
  const { data: members } = useMembers();
  const balances = useLatestBalances(accounts, snapshots);
  const [spendingEntries, setSpendingEntries] = useState<any[]>([]);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data } = await supabase.from("spending_entries").select("*").eq("household_id", active.id).order("spent_at");
      setSpendingEntries(data ?? []);
    })();
  }, [active?.id]);

  const reports = useMemo(() => {
    const weekly = () => {
      const rows: (string | number)[][] = [["Week Ending", "Account", "Category", "Owner", "Balance", "Contribution", "Payment"]];
      for (const s of [...snapshots].sort((a, b) => a.week_ending.localeCompare(b.week_ending))) {
        const a = accounts.find((x) => x.id === s.account_id); if (!a) continue;
        const owner = members.find((m) => m.id === a.member_id)?.name ?? (a.ownership === "joint" ? "Joint" : "—");
        rows.push([s.week_ending, a.name, CATEGORY_LABELS[a.category], owner, s.balance, s.contribution || 0, s.payment || 0]);
      }
      return rows;
    };
    const netWorth = () => {
      const rows: (string | number)[][] = [["Account", "Category", "Owner", "Latest Balance", "Include in NW"]];
      for (const a of accounts) {
        const owner = members.find((m) => m.id === a.member_id)?.name ?? (a.ownership === "joint" ? "Joint" : "—");
        rows.push([a.name, CATEGORY_LABELS[a.category], owner, balances.get(a.id)?.current ?? 0, a.include_in_net_worth ? "Yes" : "No"]);
      }
      return rows;
    };
    const debt = () => {
      const rows: (string | number)[][] = [["Account", "Category", "Owner", "Balance"]];
      for (const a of accounts.filter((a) => isLiability(a.category))) {
        const owner = members.find((m) => m.id === a.member_id)?.name ?? "—";
        rows.push([a.name, CATEGORY_LABELS[a.category], owner, balances.get(a.id)?.current ?? 0]);
      }
      return rows;
    };
    const savings = () => {
      const rows: (string | number)[][] = [["Account", "Category", "Owner", "Balance"]];
      for (const a of accounts.filter((a) => isAsset(a.category))) {
        const owner = members.find((m) => m.id === a.member_id)?.name ?? "—";
        rows.push([a.name, CATEGORY_LABELS[a.category], owner, balances.get(a.id)?.current ?? 0]);
      }
      return rows;
    };
    const spending = () => {
      const rows: (string | number)[][] = [["Date", "Member", "Category", "Amount", "Payment Method", "Notes"]];
      for (const s of spendingEntries) {
        const member = members.find((m) => m.id === s.member_id)?.name ?? "Household";
        const cat = SPENDING_CATEGORIES.find((c) => c.value === s.category)?.label ?? s.category;
        rows.push([s.spent_at, member, cat, Number(s.amount), s.payment_method ?? "", s.notes ?? ""]);
      }
      return rows;
    };
    return { weekly, netWorth, debt, savings, spending };
  }, [snapshots, accounts, members, balances, spendingEntries]);

  const cards = [
    { title: "Weekly Report", desc: "Every weekly snapshot, exportable.", action: () => downloadCsv("stackly-weekly.csv", reports.weekly()) },
    { title: "Net Worth Report", desc: "Latest balances per account with totals.", action: () => downloadCsv("stackly-net-worth.csv", reports.netWorth()) },
    { title: "Debt Report", desc: "Outstanding liabilities by account.", action: () => downloadCsv("stackly-debt.csv", reports.debt()) },
    { title: "Savings Report", desc: "Asset balances across the household.", action: () => downloadCsv("stackly-savings.csv", reports.savings()) },
    { title: "Spending Report", desc: "Every logged spending entry with category and member.", action: () => downloadCsv("stackly-spending.csv", reports.spending()) },
  ];

  const totalAssets = accounts.filter((a) => isAsset(a.category) && a.include_in_net_worth).reduce((s, a) => s + (balances.get(a.id)?.current ?? 0), 0);
  const totalLiabs = accounts.filter((a) => isLiability(a.category) && a.include_in_net_worth).reduce((s, a) => s + (balances.get(a.id)?.current ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Snapshot summaries you can export to CSV.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="text-xs text-muted-foreground">Total assets</div><div className="mt-1 font-display text-2xl font-bold text-success">{fmtMoney(totalAssets)}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="text-xs text-muted-foreground">Total liabilities</div><div className="mt-1 font-display text-2xl font-bold text-warning">{fmtMoney(totalLiabs)}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="text-xs text-muted-foreground">Net worth</div><div className="mt-1 font-display text-2xl font-bold text-gradient">{fmtMoney(totalAssets - totalLiabs)}</div></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-card">
            <div>
              <h3 className="font-display text-lg font-semibold">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
            <Button onClick={c.action} variant="outline"><Download className="mr-1 h-4 w-4" />CSV</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
