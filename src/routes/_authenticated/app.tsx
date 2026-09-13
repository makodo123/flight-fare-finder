import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language";
import { useLanguage } from "@/lib/language";

type RouteKey = "TPE-TYO" | "TPE-SEL" | "TPE-LON";

type Subscription = {
  route: RouteKey;
  target_price: number;
  currency: "TWD";
  subscription_status?: "active" | "pending_payment" | "cancelled" | "expired";
  current_period_end?: string;
};

const routes: Array<{
  route: RouteKey;
  city: string;
  english: string;
}> = [
  { route: "TPE-TYO", city: "台北 → 東京", english: "Taipei to Tokyo" },
  { route: "TPE-SEL", city: "台北 → 首爾", english: "Taipei to Seoul" },
  { route: "TPE-LON", city: "台北 → 倫敦", english: "Taipei to London" },
];

function apiUrl(path: string) {
  const baseUrl = import.meta.env.VITE_FLIGHT_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Flight subscriptions are not configured yet.");
  }
  return `${baseUrl}${path}`;
}

function subscriptionState(subscription?: Subscription) {
  return subscription?.subscription_status ?? "expired";
}

function isInGracePeriod(subscription?: Subscription) {
  if (!subscription || subscriptionState(subscription) !== "cancelled") return false;
  const end = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  return Boolean(end && !Number.isNaN(end.getTime()) && end.getTime() >= Date.now());
}

export default function AppShell() {
  const { user } = useOutletContext<{ user: User }>();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [targets, setTargets] = useState<Record<RouteKey, string>>({
    "TPE-TYO": "12000",
    "TPE-SEL": "10000",
    "TPE-LON": "30000",
  });
  const [loading, setLoading] = useState(true);
  const [savingRoute, setSavingRoute] = useState<RouteKey | null>(null);
  const [cancellingRoute, setCancellingRoute] = useState<RouteKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isChinese = locale === "zh-TW";
  const copy = isChinese
    ? {
        loadError: "無法讀取已訂閱航線。",
        invalidTarget: "請輸入大於 0 的目標價格。",
        saveError: "無法儲存此航線。",
        saved: (route: RouteKey, target: number) =>
          `${route} 已開始追蹤，目標價為 NT$${target.toLocaleString()}。`,
        signOut: "登出",
        console: "你的航線控制台",
        intro:
          "選擇航線並設定你願意支付的最高價格。我們每 30 分鐘檢查下個月票價，達標時會寄送 Email 通知。",
        activeBadge: "已訂閱",
        pendingBadge: "待完成付款",
        cancelledBadge: "已取消",
        expiredBadge: "已結束",
        target: "目標票價",
        syncing: "同步中…",
        tracking: (target: number) => `目前目標價：NT$${target.toLocaleString()}`,
        pending: "付款完成後才會開始通知",
        validUntil: (date: string) => `有效至：${date}`,
        ended: "訂閱已結束，重新付款即可恢復",
        inactive: "尚未設定通知",
        saving: "儲存中…",
        update: "更新目標價",
        start: "開始追蹤",
        completePayment: "完成付款",
        resubscribe: "重新訂閱",
        cancel: "取消訂閱",
        cancelling: "取消中…",
        cancelled: "訂閱已取消，仍會服務至有效期結束。",
        paymentSubmitted: "付款頁已完成，正在等待 ECPay 確認；確認後會開始寄送通知。",
        horizon: "持續追蹤更好的票價",
      }
    : {
        loadError: "Could not load your routes.",
        invalidTarget: "Enter a target price above zero.",
        saveError: "Could not save this route.",
        saved: (route: RouteKey, target: number) =>
          `${route} is now being monitored at NT$${target.toLocaleString()}.`,
        signOut: "Sign out",
        console: "Your route console",
        intro:
          "Choose a route and the highest price you are willing to pay. We check next month’s fares every 30 minutes and email you when a fare reaches your signal.",
        activeBadge: "Tracking",
        pendingBadge: "Payment pending",
        cancelledBadge: "Cancelled",
        expiredBadge: "Ended",
        target: "Target fare",
        syncing: "Synchronizing…",
        tracking: (target: number) => `Tracking at NT$${target.toLocaleString()}`,
        pending: "Alerts start after payment is confirmed",
        validUntil: (date: string) => `Valid through ${date}`,
        ended: "This subscription ended. Pay again to resume tracking.",
        inactive: "No active signal yet",
        saving: "Saving…",
        update: "Update target",
        start: "Start tracking",
        completePayment: "Complete payment",
        resubscribe: "Resubscribe",
        cancel: "Cancel subscription",
        cancelling: "Cancelling…",
        cancelled: "Subscription cancelled; service continues through the paid period.",
        paymentSubmitted: "Payment submitted. Waiting for ECPay confirmation before alerts begin.",
        horizon: "Monitoring the horizon for a better fare",
      };

  useEffect(() => {
    let current = true;

    async function loadSubscriptions() {
      try {
        const response = await fetch(
          apiUrl(`/subscriptions?email=${encodeURIComponent(user.email ?? "")}`),
        );
        if (!response.ok) throw new Error(copy.loadError);
        const payload = (await response.json()) as { items: Subscription[] };
        if (!current) return;
        const next = Object.fromEntries(payload.items.map((item) => [item.route, item]));
        setSubscriptions(next);
        setTargets((previous) => ({
          ...previous,
          ...Object.fromEntries(
            payload.items.map((item) => [item.route, String(item.target_price)]),
          ),
        }));
      } catch (error) {
        if (current) setMessage(error instanceof Error ? error.message : copy.loadError);
      } finally {
        if (current) setLoading(false);
      }
    }

    void loadSubscriptions();
    return () => {
      current = false;
    };
  }, [user.email, copy.loadError]);

  useEffect(() => {
    if (searchParams.get("purchase") === "success") {
      setMessage(copy.paymentSubmitted);
    }
  }, [copy.paymentSubmitted, searchParams]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  async function saveSubscription(route: RouteKey) {
    const targetPrice = Number(targets[route]);
    if (!Number.isInteger(targetPrice) || targetPrice < 1) {
      setMessage(copy.invalidTarget);
      return;
    }

    setSavingRoute(route);
    setMessage(null);
    try {
      const response = await fetch(apiUrl("/subscribe"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, route, target_price: targetPrice }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        const checkoutDocument = await response.text();
        document.open();
        document.write(checkoutDocument);
        document.close();
        return;
      }
      const payload = (await response.json()) as Subscription & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? copy.saveError);
      setSubscriptions((previous) => ({ ...previous, [route]: payload }));
      setMessage(copy.saved(route, targetPrice));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setSavingRoute(null);
    }
  }

  async function cancelSubscription(route: RouteKey) {
    const subscription = subscriptions[route];
    if (!subscription || subscriptionState(subscription) !== "active") return;
    setCancellingRoute(route);
    setMessage(null);
    try {
      const response = await fetch(apiUrl("/cancel"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, route }),
      });
      const payload = (await response.json()) as Subscription & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? copy.saveError);
      setSubscriptions((previous) => ({ ...previous, [route]: payload }));
      setMessage(copy.cancelled);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setCancellingRoute(null);
    }
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
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="secondary" size="sm" className="solar-button" onClick={signOut}>
              {copy.signOut}
            </Button>
          </div>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <div className="mb-5 user-signal">{copy.console}</div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Hi {user.email}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {copy.intro}
          </p>

          {message ? (
            <p className="dashboard-message mt-6" role="status">
              {message}
            </p>
          ) : null}

          <div className="subscription-grid mt-8">
            {routes.map((item) => {
              const subscription = subscriptions[item.route];
              const state = subscriptionState(subscription);
              const isSaving = savingRoute === item.route;
              const isCancelling = cancellingRoute === item.route;
              const statusLabel =
                state === "active"
                  ? copy.activeBadge
                  : state === "pending_payment"
                    ? copy.pendingBadge
                    : state === "cancelled"
                      ? copy.cancelledBadge
                      : copy.expiredBadge;
              return (
                <form
                  className="route-card"
                  key={item.route}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSubscription(item.route);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="route-code">{item.route}</p>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                        {isChinese ? item.city : item.english}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isChinese ? item.english : item.city}
                      </p>
                      {subscription ? (
                        <span className="subscription-badge">{statusLabel}</span>
                      ) : null}
                    </div>
                    <span className="route-orbit" aria-hidden="true">
                      ✦
                    </span>
                  </div>

                  <label
                    className="mt-8 block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
                    htmlFor={`target-${item.route}`}
                  >
                    {copy.target}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">NT$</span>
                    <input
                      className="route-target"
                      id={`target-${item.route}`}
                      inputMode="numeric"
                      min="1"
                      onChange={(event) =>
                        setTargets((previous) => ({
                          ...previous,
                          [item.route]: event.target.value,
                        }))
                      }
                      required
                      type="number"
                      value={targets[item.route]}
                    />
                  </div>

                  <div className="signal-line mt-7" />
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {loading
                        ? copy.syncing
                        : !subscription
                          ? copy.inactive
                          : state === "active"
                            ? copy.tracking(subscription.target_price)
                            : state === "pending_payment"
                              ? copy.pending
                              : state === "cancelled" && isInGracePeriod(subscription)
                                ? copy.validUntil(
                                    new Date(
                                      subscription.current_period_end ?? "",
                                    ).toLocaleDateString(locale),
                                  )
                                : copy.ended}
                    </p>
                    <div className="flex items-center gap-2">
                      {subscription && state === "active" ? (
                        <Button
                          className="solar-button"
                          disabled={isCancelling || loading}
                          onClick={() => void cancelSubscription(item.route)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          {isCancelling ? copy.cancelling : copy.cancel}
                        </Button>
                      ) : null}
                      <Button
                        className="solar-button"
                        disabled={isSaving || loading || isCancelling}
                        size="sm"
                        type="submit"
                      >
                        {isSaving
                          ? copy.saving
                          : state === "pending_payment"
                            ? copy.completePayment
                            : subscription && state === "expired"
                              ? copy.resubscribe
                              : subscription
                                ? copy.update
                                : copy.start}
                      </Button>
                    </div>
                  </div>
                </form>
              );
            })}
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {copy.horizon}
          </p>
        </div>
      </main>
    </div>
  );
}
