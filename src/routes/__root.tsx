import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { HouseholdProvider } from "@/lib/household-context";
import { ProfileProvider, useProfile } from "@/lib/profile-context";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <p className="mt-4 text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stackly — Household money, stacked." },
      { name: "description", content: "Stackly tracks your household's full financial picture in one place. Weekly snapshots, daily budgets, real progress." },
      { name: "theme-color", content: "#0a0a1a" },
      { property: "og:title", content: "Stackly — Household money, stacked." },
      { property: "og:description", content: "Stackly tracks your household's full financial picture in one place. Weekly snapshots, daily budgets, real progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Stackly — Household money, stacked." },
      { name: "twitter:description", content: "Stackly tracks your household's full financial picture in one place. Weekly snapshots, daily budgets, real progress." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/m2bkW6w5T3XGuthzT0CGALquCoG2/social-images/social-1777874725518-367e1627-af30-45fa-900c-e1b6ac25ef13.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/m2bkW6w5T3XGuthzT0CGALquCoG2/social-images/social-1777874725518-367e1627-af30-45fa-900c-e1b6ac25ef13.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ProfileProvider>
          <HouseholdProvider>
            <Outlet />
            <Toaster />
          </HouseholdProvider>
        </ProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
