import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RequireHousehold } from "@/components/RequireHousehold";
import { useMembers } from "@/lib/data-hooks";
import { useHousehold } from "@/lib/household-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/members")({
  component: () => (<RequireHousehold><MembersPage /></RequireHousehold>),
});

function MembersPage() {
  const { active } = useHousehold();
  const { data, refresh } = useMembers();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");

  const add = async () => {
    if (!name.trim() || !active) return;
    const { error } = await supabase.from("household_members").insert({
      household_id: active.id, name: name.trim(), relationship: relationship.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setName(""); setRelationship(""); setOpen(false); refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("household_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed"); refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">Who's in your household stack.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />Add member</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hemanth" /></div>
              <div className="space-y-1.5"><Label>Relationship (optional)</Label><Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="me, spouse, partner…" /></div>
            </div>
            <DialogFooter><Button onClick={add} className="bg-gradient-primary">Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full font-display font-bold" style={{ background: m.color ?? "#4f46e5" }}><span style={{ color: "#fff" }}>{m.name[0]?.toUpperCase()}</span></div>
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.relationship || "household member"}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {data.length === 0 && <div className="text-sm text-muted-foreground">No members yet. Add yourself first.</div>}
      </div>
    </div>
  );
}
