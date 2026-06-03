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

      {/* Members & invites */}
      <InviteSection />

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

type Lvl = "full" | "view_only" | "expenses_only";
const LEVELS: { value: Lvl; label: string; desc: string; icon: string }[] = [
  { value: "full", label: "Full access", desc: "Can see and edit everything", icon: "🔓" },
  { value: "view_only", label: "View only", desc: "Can see all data, no editing", icon: "👁" },
  { value: "expenses_only", label: "Expenses only", desc: "Can log spending only", icon: "📝" },
];

const LEVEL_LABEL: Record<Lvl, string> = {
  full: "Full access",
  view_only: "View only",
  expenses_only: "Expenses only",
};

function InviteSection() {
  const { user } = useAuth();
  const { active } = useHousehold();
  const [open, setOpen] = useState(false);
  const [inviteLevel, setInviteLevel] = useState<Lvl>("full");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeInvites, setActiveInvites] = useState<any[]>([]);

  const loadInvites = async () => {
    if (!active) return;
    const { data } = await supabase
      .from("household_invites")
      .select("*")
      .eq("household_id", active.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setActiveInvites(data ?? []);
  };

  useEffect(() => { loadInvites(); /* eslint-disable-next-line */ }, [active?.id]);

  const generateInvite = async () => {
    if (!active || !user) return;
    setGenerating(true);
    const { data, error } = await supabase
      .from("household_invites")
      .insert({
        household_id: active.id,
        invited_by: user.id,
        access_level: inviteLevel,
        invited_email: inviteEmail || null,
      } as any)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setGenerating(false);
      return;
    }
    const token = (data as any).invite_token;
    if (!token) {
      toast.error("Failed to generate invite token. Please try again.");
      setGenerating(false);
      return;
    }
    const link = `${window.location.origin}/invite/${token}`;
    setGeneratedLink(link);
    setGenerating(false);
    toast.success("Invite link generated!");
    loadInvites();
  };


  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("household_invites")
      .update({ status: "expired" } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    loadInvites();
  };

  const reset = () => {
    setInviteLevel("full");
    setInviteEmail("");
    setGeneratedLink("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Members</h3>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary"><UserPlus className="mr-2 h-4 w-4" />Invite member</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Invite to household</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Access level</Label>
                <div className="grid grid-cols-3 gap-3">
                  {LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setInviteLevel(level.value)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        inviteLevel === level.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-muted/20 hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-lg">{level.icon}</div>
                      <div className="mt-1 text-sm font-medium">{level.label}</div>
                      <div className="text-xs text-muted-foreground">{level.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Email address (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="wife@email.com"
                    type="email"
                    className="flex-1"
                  />
                  {inviteEmail && generatedLink && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const subject = encodeURIComponent("Join me on Stackly");
                        const body = encodeURIComponent(
                          `Hi! I'd like you to join my household on Stackly — our finance tracker.\n\nClick this link to join:\n${generatedLink}\n\nThis link expires in 7 days.`,
                        );
                        window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`);
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />Send email
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entering an email lets you send the link directly via your mail app.
                </p>
              </div>

              <div className="space-y-3">
                <Button onClick={generateInvite} disabled={generating} className="w-full bg-gradient-primary">
                  {generating ? "Generating…" : generatedLink ? "Regenerate link" : "Generate invite link"}
                </Button>

                {generatedLink && (
                  <div className="space-y-1.5">
                    <Label>Invite link (expires in 7 days)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono">
                        {generatedLink}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedLink);
                          toast.success("Link copied!");
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link with anyone you want to invite. It expires in 7 days and can only be used once.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeInvites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending invites.</p>
      ) : (
        <ul className="space-y-2">
          {activeInvites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    {LEVEL_LABEL[(inv.access_level as Lvl) ?? "full"]}
                  </span>
                  {inv.invited_email && (
                    <span className="truncate text-xs text-muted-foreground">{inv.invited_email}</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(inv.created_at).toLocaleDateString()} · expires {new Date(inv.expires_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const link = `${window.location.origin}/invite/${inv.invite_token}`;
                    navigator.clipboard.writeText(link);
                    toast.success("Link copied!");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>Revoke</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
