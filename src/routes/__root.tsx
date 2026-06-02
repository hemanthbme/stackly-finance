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

function ThemeApplier() {
  const { profile } = useProfile();
  const theme = profile?.theme;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const apply = (t: "light" | "dark" | "system" | undefined) => {
      if (t === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else if (t === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", prefersDark);
        root.classList.remove("light");
      }
    };
    apply(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);
  return null;
}

function RootComponent() {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ProfileProvider>
          <ThemeApplier />
          <HouseholdProvider>
            <Outlet />
            <Toaster />
          </HouseholdProvider>
        </ProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
