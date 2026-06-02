import { createFileRoute } from "@tanstack/react-router";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useHousehold } from "@/lib/household-context";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, KeyRound, UserPlus, Copy, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { COMMON_TIMEZONES, browserTz } from "@/lib/tz";

export const Route = createFileRoute("/_app/settings")({
  component: () => (<RequireHousehold><SettingsPage /></RequireHousehold>),
});

function SettingsPage() {
  const { user } = useAuth();
  const { active, refresh } = useHousehold();
  const { profile, update } = useProfile();
  const [name, setName] = useState(active?.name ?? "");
  useEffect(() => { setName(active?.name ?? ""); }, [active?.id]);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [tz, setTz] = useState(profile?.user_timezone ?? browserTz());
  const [currency, setCurrency] = useState(profile?.currency ?? "USD");
  const [dateFormat, setDateFormat] = useState(profile?.date_format ?? "MM/DD/YYYY");
  const [weekStart, setWeekStart] = useState<"sunday"|"monday">(profile?.week_start ?? "sunday");
  const [theme, setTheme] = useState<"light"|"dark"|"system">(profile?.theme ?? "system");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setTz(profile.user_timezone);
      setCurrency(profile.currency);
      setDateFormat(profile.date_format);
      setWeekStart(profile.week_start);
      setTheme(profile.theme);
    }
  }, [profile?.id]);

  const saveProfile = async () => {
    const { error } = await update({
      display_name: displayName || null,
      user_timezone: tz, currency, date_format: dateFormat, week_start: weekStart, theme,
    });
    if (error) return toast.error(error);
    toast.success("Preferences saved");
  };

  const renameHousehold = async () => {
    if (!active || !name.trim()) return;
    const { error } = await supabase.from("households").update({ name: name.trim() }).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success("Renamed"); refresh();
  };

  const deleteHousehold = async () => {
    if (!active) return;
    if (!confirm(`Delete "${active.name}" and ALL its data? This cannot be undone.`)) return;
    const { error } = await supabase.from("households").delete().eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    if (typeof window !== "undefined") localStorage.removeItem("stackly:active-household");
    refresh();
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
  };

  const allTzs = Array.from(new Set([browserTz(), ...COMMON_TIMEZONES, tz])).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalize your Stackly experience.</p>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <Field label="Email"><div className="text-sm font-medium">{user?.email}</div></Field>
        <Field label="Display name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How should we greet you?" />
        </Field>
      </Section>

      {/* Preferences */}
      <Section title="App preferences">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Time zone">
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {allTzs.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Used for daily, weekly, monthly budgets.</p>
          </Field>
          <Field label="Currency">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD","EUR","GBP","CAD","AUD","INR","JPY","SGD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date format">
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Week starts on">
            <Select value={weekStart} onValueChange={(v) => setWeekStart(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Theme">
            <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={saveProfile} className="bg-gradient-primary">Save preferences</Button>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security">
        <Button variant="outline" onClick={sendPasswordReset}>
          <KeyRound className="mr-2 h-4 w-4" />Send password reset email
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">We'll email a secure link to {user?.email}.</p>
      </Section>

      {/* Household */}
      <Section title="Household">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={renameHousehold} className="bg-gradient-primary">Save</Button>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <div>
            <Label className="text-destructive">Danger zone</Label>
            <div className="text-xs text-muted-foreground">Delete this household and all its data permanently.</div>
          </div>
          <Button variant="destructive" onClick={deleteHousehold}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
