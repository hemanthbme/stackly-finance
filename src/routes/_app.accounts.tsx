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

interface AccountFormFieldsProps {
  name: string; setName: (v: string) => void;
  category: AccountCategory; setCategory: (v: AccountCategory) => void;
  memberId: string; setMemberId: (v: string) => void;
  ownership: "individual" | "joint"; setOwnership: (v: "individual" | "joint") => void;
  institution: string; setInstitution: (v: string) => void;
  include: boolean; setInclude: (v: boolean) => void;
  members: Member[];
}

function AccountFormFields({
  name, setName, category, setCategory, memberId, setMemberId,
  ownership, setOwnership, institution, setInstitution, include, setInclude, members,
}: AccountFormFieldsProps) {
  return (
    <div className="grid gap-3">
      <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chase Checking" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as AccountCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Owner</Label>
          <Select value={memberId || "none"} onValueChange={(v) => setMemberId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Ownership</Label>
          <Select value={ownership} onValueChange={(v) => setOwnership(v as "individual" | "joint")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="joint">Joint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Institution</Label><Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="optional" /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        <div><Label>Include in net worth</Label><div className="text-xs text-muted-foreground">Toggle off to track without affecting totals</div></div>
        <Switch checked={include} onCheckedChange={setInclude} />
      </div>
    </div>
  );
}

function EditDialog({ account, members, onSaved }: { account: Account; members: Member[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.name);
  const [category, setCategory] = useState<AccountCategory>(account.category);
  const [memberId, setMemberId] = useState<string>(account.member_id ?? "");
  const [ownership, setOwnership] = useState<"individual" | "joint">(account.ownership);
  const [institution, setInstitution] = useState(account.institution ?? "");
  const [include, setInclude] = useState(account.include_in_net_worth);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(account.name);
      setCategory(account.category);
      setMemberId(account.member_id ?? "");
      setOwnership(account.ownership);
      setInstitution(account.institution ?? "");
      setInclude(account.include_in_net_worth);
    }
  }, [open, account]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("accounts").update({
      name: name.trim(),
      category,
      member_id: memberId || null,
      ownership,
      institution: institution.trim() || null,
      include_in_net_worth: include,
    }).eq("id", account.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Account updated");
    onSaved();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit account</DialogTitle></DialogHeader>
        <AccountFormFields
          name={name} setName={setName}
          category={category} setCategory={setCategory}
          memberId={memberId} setMemberId={setMemberId}
          ownership={ownership} setOwnership={setOwnership}
          institution={institution} setInstitution={setInstitution}
          include={include} setInclude={setInclude}
          members={members}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
