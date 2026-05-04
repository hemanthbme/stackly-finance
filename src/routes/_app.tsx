import { Link, Outlet, createFileRoute, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarRange, Wallet, Users, BarChart3, FileBarChart,
  PiggyBank, Settings, LogOut, Menu, X, ChevronDown, PlusCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useHousehold } from "@/lib/household-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/weekly", label: "Weekly Entry", icon: CalendarRange },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/members", label: "Members", icon: Users },
  { to: "/budget", label: "Daily Budget", icon: PiggyBank },
  { to: "/monthly", label: "Monthly Summary", icon: BarChart3 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppShell() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center bg-background"><div className="text-muted-foreground">Loading…</div></div>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar transition-transform md:relative md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <span className="font-display font-bold">S</span>
            </div>
            <span className="font-display text-lg font-bold">Stackly</span>
          </Link>
          <button className="md:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <HouseholdSwitcher />
        <nav className="px-3 py-2">
          {NAV.map((n) => {
            const active = path === n.to;
            return (
              <Link key={n.to} to={n.to} onClick={() => setMobileOpen(false)}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-3 bottom-3">
          <Button variant="ghost" className="w-full justify-start" onClick={async () => { await signOut(); toast.success("Signed out"); nav({ to: "/" }); }}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-8">
          <button className="md:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function HouseholdSwitcher() {
  const { households, active, setActiveId, refresh } = useHousehold();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { data, error } = await supabase.from("households").insert({ name: name.trim(), created_by: user.id }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); setOpen(false);
    await refresh();
    if (data) setActiveId(data.id);
    toast.success("Household created");
  };

  return (
    <div className="px-3 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-left text-sm hover:bg-sidebar-accent">
            <div>
              <div className="text-xs text-muted-foreground">Household</div>
              <div className="truncate font-medium">{active?.name ?? "No household"}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Switch household</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {households.map((h) => (
            <DropdownMenuItem key={h.id} onClick={() => setActiveId(h.id)}>{h.name}</DropdownMenuItem>
          ))}
          {households.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">No households yet</div>}
          <DropdownMenuSeparator />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" />New household
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create household</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Smiths" />
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={busy} className="bg-gradient-primary">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { Route as AppRoute };
// satisfy unused import lint
export const _unused = redirect;
