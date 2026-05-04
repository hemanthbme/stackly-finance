import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Wallet, TrendingUp, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <span className="font-display text-lg font-bold">S</span>
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Stackly</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/login">Log in</Link></Button>
          <Button asChild className="bg-gradient-primary shadow-glow"><Link to="/signup">Get started</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-20 pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" /> Built to replace your finance spreadsheet
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Household money,<br />
            <span className="text-gradient">stacked.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            One weekly snapshot. Every account. Real net worth, real progress —
            for you, your partner, and the whole household.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className="bg-gradient-primary shadow-glow">
              <Link to="/signup">Start stacking <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">I have an account</Link>
            </Button>
          </div>
        </div>

        <div className="mt-24 grid gap-4 md:grid-cols-3">
          {[
            { icon: Wallet, title: "Weekly snapshots", body: "Drop in your balances once a week. We do the math." },
            { icon: BarChart3, title: "Net worth, live", body: "Assets, debts, retirement — clean charts, no fluff." },
            { icon: TrendingUp, title: "Daily budgets", body: "Stay on track day-by-day with friendly nudges." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card/60 p-6 shadow-card backdrop-blur">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
