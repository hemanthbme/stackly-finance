import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Stackly" },
      { name: "description", content: "Set a new password for your Stackly household finance account." },
      { property: "og:title", content: "Choose a new password — Stackly" },
      { property: "og:description", content: "Set a new password for your Stackly household finance account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) setStatus("valid");
    });

    (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled && !error && data.session) {
            setStatus("valid");
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setStatus(data.session ? "valid" : "invalid");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return toast.error(updateError.message);
    toast.success("Password updated");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-card backdrop-blur">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary"><span className="font-display font-bold">S</span></div>
          <span className="font-display text-lg font-bold">Stackly</span>
        </Link>

        {status === "checking" && (
          <div className="py-10 text-center text-sm text-muted-foreground">Verifying your link…</div>
        )}

        {status === "invalid" && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-bold">Link expired</h1>
            <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
            <Button asChild className="w-full bg-gradient-primary shadow-glow">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        )}

        {status === "valid" && (
          <>
            <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Make it at least 8 characters.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary shadow-glow">
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
