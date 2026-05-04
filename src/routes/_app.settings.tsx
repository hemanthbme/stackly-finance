import { createFileRoute } from "@tanstack/react-router";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useHousehold } from "@/lib/household-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: () => (<RequireHousehold><SettingsPage /></RequireHousehold>),
});

function SettingsPage() {
  const { user } = useAuth();
  const { active, refresh } = useHousehold();
  const [name, setName] = useState(active?.name ?? "");

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and active household.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-semibold">Account</h3>
        <div className="mt-3 text-sm"><span className="text-muted-foreground">Email:</span> <span className="font-medium">{user?.email}</span></div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-semibold">Household</h3>
        <div className="mt-3 flex gap-2">
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
      </div>
    </div>
  );
}
