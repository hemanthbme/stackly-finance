import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Account, Member } from "@/lib/data-hooks";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useAccounts, useMembers } from "@/lib/data-hooks";
import { useHousehold } from "@/lib/household-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CATEGORY_LABELS, type AccountCategory, isAsset } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/accounts")({
  component: () => (<RequireHousehold><AccountsPage /></RequireHousehold>),
});

const CATS = Object.keys(CATEGORY_LABELS) as AccountCategory[];

function AccountsPage() {
  const { active } = useHousehold();
  const { data: members } = useMembers();
  const { data, refresh } = useAccounts();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AccountCategory>("checking");
  const [memberId, setMemberId] = useState<string>("");
  const [ownership, setOwnership] = useState<"individual" | "joint">("individual");
  const [institution, setInstitution] = useState("");
  const [include, setInclude] = useState(true);

  const add = async () => {
    if (!name.trim() || !active) return;
    const { error } = await supabase.from("accounts").insert({
      household_id: active.id,
      name: name.trim(),
      category,
      member_id: memberId || null,
      ownership,
      institution: institution.trim() || null,
      include_in_net_worth: include,
    });
    if (error) return toast.error(error.message);
    toast.success("Account added");
    setName(""); setInstitution(""); setOpen(false); refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this account and all its snapshots?")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">All the money buckets you track.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />Add account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
            <AccountFormFields
              name={name} setName={setName}
              category={category} setCategory={setCategory}
              memberId={memberId} setMemberId={setMemberId}
              ownership={ownership} setOwnership={setOwnership}
              institution={institution} setInstitution={setInstitution}
              include={include} setInclude={setInclude}
              members={members}
            />
            <DialogFooter><Button onClick={add} className="bg-gradient-primary">Add account</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => {
              const m = members.find((x) => x.id === a.member_id);
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    {a.institution && <div className="text-xs text-muted-foreground">{a.institution}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={isAsset(a.category) ? "border-success/40 text-success" : "border-warning/40 text-warning"}>
                      {CATEGORY_LABELS[a.category]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{m?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 capitalize">{a.ownership}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditDialog account={a} members={members} onSaved={refresh} />
                      <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No accounts yet. Add your first one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
