import { useHousehold } from "@/lib/household-context";
import { type ReactNode } from "react";
import { Wallet } from "lucide-react";

export function RequireHousehold({ children }: { children: ReactNode }) {
  const { active, loading, households } = useHousehold();
  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!active) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Wallet className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Create your first household</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the household switcher in the sidebar to get started. You can add members and accounts after.
        </p>
        {households.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Tip: pick one from the switcher.</p>}
      </div>
    );
  }
  return <>{children}</>;
}
