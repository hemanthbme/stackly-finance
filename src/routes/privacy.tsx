import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Stackly" },
      { name: "description", content: "How Stackly protects your financial data and respects your privacy." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary">
              <span className="font-display font-bold">S</span>
            </div>
            <span className="font-display text-lg font-bold">Stackly</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="prose prose-invert mt-8 max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="font-display text-2xl font-semibold">Overview</h2>
            <p className="mt-3 text-muted-foreground">
              Stackly helps households track their finances together. This policy describes what we collect,
              how we use it, and the strong privacy protections built into the product.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold">Data we collect</h2>
            <p className="mt-3 text-muted-foreground">
              Account details you provide (email, display name), the household and member names you create,
              and the financial entries you record (account balances, weekly snapshots, spending, budgets).
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold">Data security</h2>
            <p className="mt-3 text-muted-foreground">
              All data is transmitted over TLS and stored encrypted at rest. Access to financial tables is
              gated by per-row policies tied to your authenticated account and household membership.
              Row Level Security is enforced at the database level with Force RLS enabled, meaning no
              query — including from the app owner — can bypass your data privacy protections.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold">Financial data privacy</h2>
            <p className="mt-3 text-muted-foreground">
              Stackly is designed so that your financial data is private — even from us.
            </p>
            <p className="mt-3 text-muted-foreground">
              We have implemented Force Row Level Security (RLS) on all financial tables including account
              balances, weekly snapshots, spending entries, and budgets. This means that even the app owner
              cannot access your financial data through normal database queries. Your data is only readable
              by your own account and household members you have explicitly invited.
            </p>
            <p className="mt-3 text-muted-foreground">
              The only information visible to the app owner for support and maintenance purposes is basic
              account information — your email address, the name of your household, your signup date, and
              your last active date. We cannot see your balances, spending history, budgets, or any
              financial figures.
            </p>
            <p className="mt-3 text-muted-foreground">
              We will never sell, share, or use your financial data for any purpose other than providing
              the Stackly service to you.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold">Your rights</h2>
            <p className="mt-3 text-muted-foreground">
              You can export or delete your data at any time from Settings. If you need help, reach out via
              the in-app Help page.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold">Contact</h2>
            <p className="mt-3 text-muted-foreground">
              Questions about this policy? Use the Help page inside the app and we'll get back to you.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
