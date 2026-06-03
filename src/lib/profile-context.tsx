import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { browserTz } from "./tz";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  user_timezone: string;
  currency: string;
  date_format: string;
  week_start: "sunday" | "monday";
  theme: "light" | "dark" | "system";
  onboarding_completed: boolean;
}

interface Ctx {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  update: (patch: Partial<Profile>) => Promise<{ error?: string }>;
  tz: string;
}

const ProfileCtx = createContext<Ctx>({ profile: null, loading: true, refresh: async () => {}, refreshProfile: async () => {}, update: async () => ({}), tz: browserTz() });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      const p = data as any;
      // Auto-set timezone to browser if still default UTC and they're not in UTC
      if ((!p.user_timezone || p.user_timezone === "UTC") && browserTz() !== "UTC") {
        const detected = browserTz();
        await supabase.from("profiles").update({ user_timezone: detected }).eq("id", user.id);
        p.user_timezone = detected;
      }
      setProfile({
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        user_timezone: p.user_timezone || browserTz(),
        currency: p.currency || "USD",
        date_format: p.date_format || "MM/DD/YYYY",
        week_start: (p.week_start as any) || "sunday",
        theme: (p.theme as any) || "system",
        onboarding_completed: !!p.onboarding_completed,
      });
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  const update = async (patch: Partial<Profile>) => {
    if (!user) return { error: "Not signed in" };
    const { error } = await supabase.from("profiles").update(patch as any).eq("id", user.id);
    if (error) return { error: error.message };
    await refresh();
    return {};
  };

  return (
    <ProfileCtx.Provider value={{ profile, loading, refresh, refreshProfile: refresh, update, tz: profile?.user_timezone || browserTz() }}>
      {children}
    </ProfileCtx.Provider>
  );
}

export const useProfile = () => useContext(ProfileCtx);
