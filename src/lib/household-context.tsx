import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export interface Household { id: string; name: string; created_by: string }

interface Ctx {
  households: Household[];
  active: Household | null;
  setActiveId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const HouseholdCtx = createContext<Ctx>({ households: [], active: null, setActiveId: () => {}, refresh: async () => {}, loading: true });

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setHouseholds([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("households").select("*").order("created_at");
    const list = (data ?? []) as Household[];
    setHouseholds(list);
    const stored = typeof window !== "undefined" ? localStorage.getItem("stackly:active-household") : null;
    const next = list.find((h) => h.id === stored)?.id ?? list[0]?.id ?? null;
    setActiveIdState(next);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  const setActiveId = (id: string) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("stackly:active-household", id);
  };

  return (
    <HouseholdCtx.Provider
      value={{ households, active: households.find((h) => h.id === activeId) ?? null, setActiveId, refresh, loading }}
    >
      {children}
    </HouseholdCtx.Provider>
  );
}

export const useHousehold = () => useContext(HouseholdCtx);
