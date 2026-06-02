import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/help")({
  component: HelpPage,
});

const STEPS = [
  { title: "Create your household", desc: "Go to the sidebar household switcher at the top and click 'New household'. Give it a name like 'The [Your Name] Family'." },
  { title: "Add members", desc: "Go to Members and add yourself and your partner. This lets you assign accounts and spending to each person." },
  { title: "Add your accounts", desc: "Go to Accounts and add every financial account you have — checking, savings, credit cards, 401k, mortgage, everything. Don't worry about balances yet." },
  { title: "Log your first weekly snapshot", desc: "Go to Weekly Snapshot, set the date to this Sunday, and type in the current balance for each account. Hit Save." },
  { title: "Set a budget", desc: "Go to Daily Budget, create a combined daily budget with your household's daily spending limit, then start logging spending entries." },
  { title: "Check your dashboard", desc: "Your net worth, assets, liabilities, and budget status will all appear on the Dashboard once you have at least one snapshot saved." },
];

const FAQS = [
  { q: "What is a weekly snapshot?", a: "A weekly snapshot is a manual record of every account balance at the end of the week. Stackly uses these snapshots to calculate your net worth over time and show you trends." },
  { q: "Why do I have to enter balances manually?", a: "Manual entry keeps your data private — no bank credentials are ever stored. Automatic bank sync via Plaid is coming soon." },
  { q: "What's the difference between individual and joint accounts?", a: "Individual accounts belong to one member. Joint accounts count toward both members' views on the dashboard." },
  { q: "What does 'include in net worth' mean?", a: "If toggled on, that account's balance is counted in your net worth calculation. Toggle it off for accounts you want to track but not include — like a business account." },
  { q: "Can I use Stackly on my phone?", a: "Yes — open Stackly in Safari on iPhone, tap the share button, and choose 'Add to Home Screen' to install it like an app." },
  { q: "How do I delete my data?", a: "Go to Settings, scroll to the bottom, and click 'Delete household'. This permanently removes all accounts, snapshots, budgets, and spending entries for that household." },
  { q: "Is my financial data safe?", a: "Yes. All data is stored in Supabase with row-level security, meaning only your account can access your data. Connections are encrypted via HTTPS." },
  { q: "Can I invite my partner to the same household?", a: "Multi-user household sharing is on the roadmap. For now, one login per household is the recommended approach." },
];

function HelpPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("General question");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) return toast.error("Please enter a message");
    if (!user) return toast.error("Not signed in");
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: user.id,
      email: user.email ?? null,
      subject,
      message: message.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Message sent — we'll be in touch soon!");
    setMessage("");
    setSubject("General question");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Help</h1>
        <p className="text-muted-foreground">Quick start, FAQs, and a way to reach us.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Getting started</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-muted-foreground">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Frequently asked questions</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Send us a message</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Have a question, found a bug, or want to suggest a feature? Send us a message and we'll get back to you.
          </p>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="General question">General question</SelectItem>
                <SelectItem value="Bug report">Bug report</SelectItem>
                <SelectItem value="Feature request">Feature request</SelectItem>
                <SelectItem value="Billing">Billing</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              className="h-32"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your question or issue..."
            />
          </div>
          <Button onClick={submit} disabled={sending} className="bg-gradient-primary">
            {sending ? "Sending…" : "Send message"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
