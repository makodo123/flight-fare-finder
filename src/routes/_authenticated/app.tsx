import { Link, useNavigate, useOutletContext } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function AppShell() {
  const { user } = useOutletContext<{ user: User }>();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="dashboard-surface text-foreground">
      <header className="dashboard-header border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="brand-lockup" aria-label="Flight Price Notifier home">
            <span className="brand-symbol" aria-hidden="true">
              ✦
            </span>
            <span>
              Flight Price
              <br />
              Notifier
            </span>
          </Link>
          <Button variant="secondary" size="sm" className="solar-button" onClick={signOut}>
            Sign out / 登出
          </Button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="mb-5 user-signal">Your route console</div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Hi {user.email}</h1>
          <div className="dashboard-card mt-8">
            <p className="text-lg leading-relaxed">
              你的航線追蹤儀表板即將上線 — 下一個里程碑會加上訂閱航線的功能。
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Your dashboard is coming soon. Route-subscription will be added in the next milestone.
            </p>
            <div className="signal-line mt-8" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Monitoring the horizon for a better fare
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
