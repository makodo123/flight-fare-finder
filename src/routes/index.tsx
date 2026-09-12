import { Link } from "react-router-dom";
import { Plane, BellRing, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";

const features = [
  {
    icon: Plane,
    title: "盯緊熱門航線",
    en: "Always-on route watching",
    body: "持續監控台北出發的熱門航線（東京、首爾），自動抓最低票價。",
  },
  {
    icon: BellRing,
    title: "達標自動通知",
    en: "Target-price email alerts",
    body: "低於你設定的目標價，就寄 email 提醒你，附上立即訂購連結。",
  },
  {
    icon: XCircle,
    title: "隨時取消",
    en: "Cancel anytime",
    body: "月訂閱制，不想用隨時停，沒有綁約。",
  },
];

export default function Landing() {
  return (
    <div className="solar-page text-foreground">
      <header className="solar-header sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
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
          <div className="flex items-center gap-5">
            <span className="header-signal hidden sm:inline-flex">TPE / live fare signal</span>
            <Button asChild size="sm" className="header-cta">
              <Link to="/sign-in">Sign in / 登入</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-surface">
          <div className="mx-auto max-w-6xl px-5">
            <div className="hero-content">
              <Reveal>
                <div className="eyebrow-chip">台北出發 · 東京 / 首爾</div>
                <h1 className="hero-title">
                  Flight Price
                  <br />
                  <span className="title-outline">Notifier</span>
                </h1>
                <p className="hero-subtitle">設定航線與目標價，機票降價就通知你</p>
                <p className="hero-copy">
                  Set a route and a target price — we email you when the fare drops. Follow the
                  signal, then take off.
                </p>
                <div className="hero-actions">
                  <Button asChild size="lg" className="solar-button">
                    <Link to="/sign-in">Sign in / 登入</Link>
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={180}>
                <div className="hero-orbit-card" aria-label="Live route signal preview">
                  <div className="orbit-card-top">
                    <span>Route watch</span>
                    <strong>Live</strong>
                  </div>
                  <div className="orbit-visual" aria-hidden="true">
                    <div className="orbit-globe">✦</div>
                  </div>
                  <div className="orbit-card-bottom">
                    <span>TPE / NRT</span>
                    <span>Price signal</span>
                  </div>
                  <div className="signal-line" />
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Watch the horizon for a fare worth catching.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <p className="section-kicker">The signal beneath the surface</p>
              <h2 className="section-title">One quiet signal. A better time to fly.</h2>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Reveal key={f.en} delay={i * 120}>
                  <article className="feature-card h-full">
                    <div className="feature-index">0{i + 1} / 03</div>
                    <div className="feature-icon">
                      <f.icon className="size-5" />
                    </div>
                    <h2>
                      {f.title} <span>({f.en})</span>
                    </h2>
                    <p className="mt-3 text-sm">{f.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="solar-footer border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="brand-lockup text-[0.58rem]">
            <span className="brand-symbol size-6 text-xs" aria-hidden="true">
              ✦
            </span>
            Flight Price Notifier
          </span>
          <span>© 2026 Flight Price Notifier · Keep your eyes on the horizon.</span>
        </div>
      </footer>
    </div>
  );
}
