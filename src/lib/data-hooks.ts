import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household-context";
import type { AccountCategory } from "@/lib/finance";

export interface Member { id: string; name: string; relationship: string | null; color: string | null }
export interface Account {
  id: string; household_id: string; member_id: string | null; name: string;
  category: AccountCategory; ownership: "individual" | "joint"; institution: string | null;
  include_in_net_worth: boolean; is_active: boolean;
}
export interface Snapshot {
  id: string; household_id: string; account_id: string; week_ending: string;
  balance: number; contribution: number | null; payment: number | null; notes: string | null;
}

export function useMembers() {
  const { active } = useHousehold();
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    if (!active) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("household_members").select("*").eq("household_id", active.id).order("created_at");
    setData((data ?? []) as Member[]); setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [active?.id]);
  return { data, loading, refresh };
}

export function useAccounts() {
  const { active } = useHousehold();
  const [data, setData] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    if (!active) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("accounts").select("*").eq("household_id", active.id).order("name");
    setData((data ?? []) as Account[]); setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [active?.id]);
  return { data, loading, refresh };
}

export function useSnapshots() {
  const { active } = useHousehold();
  const [data, setData] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    if (!active) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("weekly_snapshots").select("*").eq("household_id", active.id).order("week_ending");
    setData((data ?? []).map((r: any) => ({ ...r, balance: Number(r.balance), contribution: r.contribution ? Number(r.contribution) : 0, payment: r.payment ? Number(r.payment) : 0 })) as Snapshot[]);
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [active?.id]);
  return { data, loading, refresh };
}

export function useLatestBalances(accounts: Account[], snapshots: Snapshot[]) {
  return useMemo(() => {
    const map = new Map<string, { current: number; previous: number; weekEnding?: string }>();
    for (const a of accounts) {
      const rows = snapshots.filter((s) => s.account_id === a.id).sort((a, b) => a.week_ending.localeCompare(b.week_ending));
      const last = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      map.set(a.id, { current: last?.balance ?? 0, previous: prev?.balance ?? 0, weekEnding: last?.week_ending });
    }
    return map;
  }, [accounts, snapshots]);
}
