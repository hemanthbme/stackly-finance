import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "your@email.com";

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
});

interface SupportMessage {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

function InboxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_messages" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as SupportMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) load();
  }, [user?.email]);

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Not authorized</h1>
        <p className="text-muted-foreground">You don't have access to this page.</p>
      </div>
    );
  }

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("support_messages" as any)
      .update({ status: "read" } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: "read" } : x)));
  };

  const unread = rows.filter((r) => r.status !== "read").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Inbox</h1>
        {unread > 0 && <Badge className="bg-gradient-primary">{unread} unread</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>Support messages</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground">No messages yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={cn(r.status !== "read" && "bg-primary/5")}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{r.email ?? "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{r.subject}</TableCell>
                    <TableCell className="max-w-md text-sm whitespace-pre-wrap">{r.message}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "read" ? "secondary" : "default"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status !== "read" && (
                        <Button size="sm" variant="outline" onClick={() => markRead(r.id)}>
                          Mark read
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
