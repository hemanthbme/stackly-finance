import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

type Preview = {
  household_id: string;
  household_name: string;
  access_level: "full" | "view_only" | "expenses_only";
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  created_by: string;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const LEVEL_META: Record<Preview["access_level"], { label: string; cls: string }> = {
  full: { label: "Full access — can see and edit everything", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  view_only: { label: "View only — can see all data but not make changes", cls: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
  expenses_only: { label: "Expenses only — can log spending entries", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
};

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [invite, setInvite] = useState<Preview | null>(null);
  const [fetching, setFetching] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_invite_preview", { _token: token });
      setInvite((data?.[0] as Preview | undefined) ?? null);
      setFetching(false);
    })();
  }, [token]);

  const acceptInvite = async () => {
    if (!user) return;
    setAccepting(true);
    const memberName = user.email?.split("@")[0] ?? "Member";
    const { error } = await supabase.rpc("accept_household_invite", { _token: token, _name: memberName });
    if (error) {
      toast.error(error.message);
      setAccepting(false);
      return;
    }
    if (invite && typeof window !== "undefined") {
      localStorage.setItem("stackly:active-household", invite.household_id);
    }
    toast.success("Welcome! You've joined the household.");
    nav({ to: "/dashboard" });
  };

  const expired = invite && (invite.status === "expired" || new Date(invite.expires_at) < new Date());
  const used = invite?.status === "accepted";

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-card backdrop-blur">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary">
            <span className="font-display font-bold">S</span>
          </div>
          <span className="font-display text-lg font-bold">Stackly</span>
        </Link>

        {fetching || loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        ) : !invite ? (
          <ErrorCard message="This invite link has expired or is invalid." />
        ) : expired ? (
          <ErrorCard message="This invite link has expired or is invalid." />
        ) : used ? (
          <div className="space-y-4 text-center">
            <h1 className="font-display text-2xl font-bold">Already used</h1>
            <p className="text-sm text-muted-foreground">This invite has already been used.</p>
            <Button asChild className="bg-gradient-primary w-full">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">You've been invited to join</p>
              <h1 className="mt-1 font-display text-2xl font-bold">{invite.household_name}</h1>
            </div>
            <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${LEVEL_META[invite.access_level].cls}`}>
              {LEVEL_META[invite.access_level].label}
            </div>

            {user ? (
              <Button onClick={acceptInvite} disabled={accepting} className="w-full bg-gradient-primary">
                {accepting ? "Joining…" : "Accept invite"}
              </Button>
            ) : (
              <div className="grid gap-2">
                <Button asChild className="w-full bg-gradient-primary">
                  <Link to="/login" search={{ redirect: `/invite/${token}` } as any}>Sign in to accept</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/signup" search={{ redirect: `/invite/${token}` } as any}>Create account</Link>
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              This invite expires {fmtDate(invite.expires_at)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="font-display text-2xl font-bold">Invite unavailable</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="w-full">
        <Link to="/">Go to Stackly</Link>
      </Button>
    </div>
  );
}
