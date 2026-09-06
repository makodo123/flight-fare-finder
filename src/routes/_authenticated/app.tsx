import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flight Price Notifier" },
      { name: "description", content: "你的航線追蹤儀表板 — Flight Price Notifier." },
      { property: "og:title", content: "Dashboard — Flight Price Notifier" },
      { property: "og:description", content: "Your flight route tracking dashboard." },
    ],
  }),
  component: AppShell,
});

function AppShell() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-sm font-semibold tracking-tight">Flight Price Notifier</span>
          <Button variant="secondary" size="sm" onClick={signOut}>
            Sign out / 登出
          </Button>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-5 py-20">
          <h1 className="text-2xl font-semibold sm:text-3xl">Hi {user.email}</h1>
          <div className="mt-8 rounded-2xl border border-border bg-card p-8">
            <p className="text-base">
              你的航線追蹤儀表板即將上線 — 下一個里程碑會加上訂閱航線的功能。
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Your dashboard is coming soon. Route-subscription will be added in the next milestone.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
