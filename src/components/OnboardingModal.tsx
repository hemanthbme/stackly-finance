import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useHousehold } from "@/lib/household-context";
import { useProfile } from "@/lib/profile-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney, signedBalance, CATEGORY_LABELS } from "@/lib/finance";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountCategory } from "@/lib/finance";

const ALLOWED_CATEGORIES: AccountCategory[] = [
  "checking", "savings", "credit_card", "retirement_401k",
  "brokerage", "mortgage", "car_loan", "other_asset", "other_liability",
];

interface MemberDraft { name: string; relationship: string }
interface AccountDraft {
  name: string;
  category: AccountCategory;
  balance: string;
  ownership: "individual" | "joint";
  memberIndex: number;
}

export function OnboardingModal() {
  const { user } = useAuth();
  const { active, refresh: refreshHouseholds } = useHousehold();
  const { profile, refreshProfile } = useProfile();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([{ name: "", relationship: "me" }]);
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: "", category: "checking", balance: "", ownership: "individual", memberIndex: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [netWorth, setNetWorth] = useState(0);

  if (!profile || profile.onboarding_completed) return null;

  const skipOnboarding = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", user.id);
    await refreshProfile();
  };

  const ensureHousehold = async (): Promise<string | null> => {
    if (active) return active.id;
    if (!user) return null;
    const { data, error } = await supabase
      .from("households")
      .insert({ name: householdName.trim() || "My Household", created_by: user.id })
      .select()
      .single();
    if (error || !data) return null;
    await refreshHouseholds();
    return (data as any).id;
  };

  const completeOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const householdId = await ensureHousehold();
      if (!householdId) throw new Error("Could not create household");

      if (householdName.trim()) {
        await supabase.from("households")
          .update({ name: householdName.trim() })
          .eq("id", householdId);
      }

      const memberIds: Record<number, string> = {};
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m.name.trim()) continue;
        const { data } = await supabase
          .from("household_members")
          .insert({
            household_id: householdId,
            name: m.name.trim(),
            relationship: m.relationship,
          })
          .select()
          .single();
        if (data) memberIds[i] = (data as any).id;
      }

      const weekEnd = new Date();
      const day = weekEnd.getDay();
      weekEnd.setDate(weekEnd.getDate() + (6 - day));
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      let totalNet = 0;
      for (const acct of accounts) {
        if (!acct.name.trim() || !acct.balance) continue;
        const balance = Math.abs(Number(acct.balance));
        const memberId = acct.ownership === "joint"
          ? null
          : memberIds[acct.memberIndex] ?? null;

        const { data: acctData } = await supabase
          .from("accounts")
          .insert({
            household_id: householdId,
            name: acct.name.trim(),
            category: acct.category,
            ownership: acct.ownership,
            member_id: memberId,
            include_in_net_worth: true,
          })
          .select()
          .single();

        if (acctData) {
          await supabase.from("weekly_snapshots").insert({
            household_id: householdId,
            account_id: (acctData as any).id,
            week_ending: weekEndStr,
            balance,
          });
          totalNet += signedBalance(acct.category, balance);
        }
      }

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("id", user.id);

      await refreshHouseholds();
      setNetWorth(totalNet);
      setSaving(false);
      setStep(4);
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const onComplete = async () => {
    await refreshProfile();
    navigate({ to: "/dashboard" });
  };

  const updateMember = (i: number, patch: Partial<MemberDraft>) =>
    setMembers((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const updateAccount = (i: number, patch: Partial<AccountDraft>) =>
    setAccounts((a) => a.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="p-6">
          <div className="mb-6 flex justify-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  s === step ? "bg-primary" : s < step ? "bg-primary/50" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <div>
              <h2 className="text-center font-display text-2xl font-bold">Welcome to Stackly 👋</h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Let's get your finances set up in 3 quick steps.
              </p>
              <Label>What should we call your household?</Label>
              <Input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g. The Johnson Family"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is just a name for your household — you can change it later in Settings.
              </p>
              <Button
                className="mt-6 w-full bg-gradient-primary"
                disabled={householdName.trim().length === 0}
                onClick={() => setStep(2)}
              >
                Next →
              </Button>
              <button
                onClick={skipOnboarding}
                className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Skip setup
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl font-bold">Who's in your household?</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Add yourself and anyone you share finances with.
              </p>
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={m.name}
                      onChange={(e) => updateMember(i, { name: e.target.value })}
                      placeholder="e.g. Hemanth"
                      className="flex-1"
                    />
                    <Select value={m.relationship} onValueChange={(v) => updateMember(i, { relationship: v })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="me">Me</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {i > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMembers((arr) => arr.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => setMembers((m) => [...m, { name: "", relationship: "other" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add another person
              </Button>
              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
                <Button
                  className="bg-gradient-primary"
                  disabled={!members.some((m) => m.name.trim().length > 0)}
                  onClick={() => setStep(3)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-2xl font-bold">Add your accounts</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Enter your current balances. You can always add more later.
              </p>
              <div className="space-y-3">
                {accounts.map((acct, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex gap-2">
                      <Input
                        value={acct.name}
                        onChange={(e) => updateAccount(i, { name: e.target.value })}
                        placeholder="e.g. Chase Checking"
                        className="flex-1"
                      />
                      {accounts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAccounts((arr) => arr.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Select
                      value={acct.category}
                      onValueChange={(v) => updateAccount(i, { category: v as AccountCategory })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALLOWED_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        inputMode="decimal"
                        value={acct.balance}
                        onChange={(e) => updateAccount(i, { balance: e.target.value })}
                        placeholder="0.00"
                      />
                      <Select
                        value={acct.ownership === "joint" ? "joint" : String(acct.memberIndex)}
                        onValueChange={(v) => {
                          if (v === "joint") updateAccount(i, { ownership: "joint" });
                          else updateAccount(i, { ownership: "individual", memberIndex: Number(v) });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {members.map((m, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {m.name.trim() || `Member ${idx + 1}`}
                            </SelectItem>
                          ))}
                          <SelectItem value="joint">Joint</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() =>
                  setAccounts((a) => [
                    ...a,
                    { name: "", category: "checking", balance: "", ownership: "individual", memberIndex: 0 },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add another account
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                💡 Add credit cards and loans too — they give you a true net worth picture
              </p>
              <Button
                className="mt-6 w-full bg-gradient-primary"
                disabled={saving}
                onClick={completeOnboarding}
              >
                {saving ? "Setting up…" : "Finish setup →"}
              </Button>
              <button
                onClick={() => setStep(2)}
                className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h2 className="font-display text-2xl font-bold">You're all set!</h2>
              {netWorth > 0 && (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">Your starting net worth</p>
                  <p className="font-display text-3xl font-bold text-success">{fmtMoney(netWorth)}</p>
                </>
              )}
              {netWorth < 0 && (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">Your starting net worth</p>
                  <p className="font-display text-3xl font-bold text-destructive">{fmtMoney(netWorth)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    That's okay — Stackly will help you track your progress.
                  </p>
                </>
              )}
              {netWorth === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your dashboard is ready. Start by logging your first weekly snapshot.
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                You can add more accounts, set a budget, and invite your partner from Settings.
              </p>
              <Button className="mt-6 w-full bg-gradient-primary" onClick={onComplete}>
                Go to my dashboard →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
