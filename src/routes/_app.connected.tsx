import { createFileRoute } from "@tanstack/react-router";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useHousehold } from "@/lib/household-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Link2, Plug, Trash2, ShieldCheck } from "lucide-react";
import { fmtMoney } from "@/lib/finance";

export const Route = createFileRoute("/_app/connected")({
  component: () => (<RequireHousehold><ConnectedPage /></RequireHousehold>),
});

interface Inst { id: string; institution_name: string; provider: string; status: string; last_synced_at: string | null }
interface ConnAcct { id: string; institution_id: string; name: string; type: string | null; subtype: string | null; mask: string | null; current_balance: number }

function ConnectedPage() {
  const { active } = useHousehold();
  const [insts, setInsts] = useState<Inst[]>([]);
  const [accts, setAccts] = useState<ConnAcct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!active) return;
    setLoading(true);
    const [i, a] = await Promise.all([
      supabase.from("connected_institutions").select("*").eq("household_id", active.id).order("created_at"),
      supabase.from("connected_accounts").select("*").eq("household_id", active.id).order("name"),
    ]);
    setInsts((i.data ?? []) as any);
    setAccts(((a.data ?? []) as any[]).map((r) => ({ ...r, current_balance: Number(r.current_balance ?? 0) })));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active?.id]);

  const disconnect = async (id: string) => {
    if (!confirm("Disconnect this institution? Synced accounts will also be removed.")) return;
    const { error } = await supabase.from("connected_institutions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Disconnected");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground">Securely link banks, cards, loans, and investment accounts.</p>
        </div>
        <Button disabled className="bg-gradient-primary opacity-70">
          <Plug className="mr-2 h-4 w-4" />Connect account (coming soon)
        </Button>
      </div>

      {/* Consent / trust banner */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-success" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Your data, your control.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Stackly uses Plaid to connect your accounts — we never see your bank password.</li>
              <li>Only secure access tokens are stored, encrypted on our servers.</li>
              <li>Disconnect any institution at any time. Manual accounts always work as a fallback.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!loading && insts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <Banknote className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold">No connected institutions yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Live bank syncing via Plaid is launching soon. In the meantime, add manual accounts on the Accounts page and log weekly snapshots to track your full financial picture.
          </p>
        </div>
      )}

      {/* Institutions list */}
      {insts.length > 0 && (
        <div className="space-y-4">
          {insts.map((i) => {
            const linked = accts.filter((a) => a.institution_id === i.id);
            return (
              <div key={i.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <h3 className="font-display text-lg font-semibold">{i.institution_name}</h3>
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">{i.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      via {i.provider} · last synced {i.last_synced_at ? new Date(i.last_synced_at).toLocaleString() : "—"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => disconnect(i.id)}>
                    <Trash2 className="mr-1 h-4 w-4" />Disconnect
                  </Button>
                </div>
                {linked.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {linked.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3 text-sm">
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[a.type, a.subtype].filter(Boolean).join(" · ")}{a.mask ? ` · •••${a.mask}` : ""}
                          </div>
                        </div>
                        <div className="font-mono">{fmtMoney(a.current_balance)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
