import { Link } from "react-router-dom";
import { Plane, BellRing, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { LanguageToggle } from "@/components/language";
import { useLanguage } from "@/lib/language";

const features = [
  {
    icon: Plane,
    zh: {
      title: "盯緊熱門航線",
      label: "持續追蹤航線",
      body: "持續監控台北出發的熱門航線（東京、首爾），自動抓取最低票價。",
    },
    en: {
      title: "Always-on route watching",
      label: "Route monitoring",
      body: "We continuously monitor popular routes from Taipei to find the lowest fare.",
    },
  },
  {
    icon: BellRing,
    zh: {
      title: "達標自動通知",
      label: "目標價 Email 通知",
      body: "低於你設定的目標價，就寄 Email 提醒你，附上立即訂購連結。",
    },
    en: {
      title: "Target-price email alerts",
      label: "Email alerts",
      body: "When a fare meets your target, we email you an alert with a booking link.",
    },
  },
  {
    icon: XCircle,
    zh: { title: "隨時取消", label: "沒有綁約", body: "不想再追蹤時，可以隨時停止，沒有綁約。" },
    en: {
      title: "Cancel anytime",
      label: "No lock-in",
      body: "Stop tracking whenever you like, with no long-term commitment.",
    },
  },
];

export default function Landing() {
  const { locale } = useLanguage();
  const isChinese = locale === "zh-TW";
  const copy = isChinese
    ? {
        signal: "TPE／即時票價訊號",
        signIn: "登入",
        eyebrow: "台北出發 · 東京／首爾",
        subtitle: "設定航線與目標價，機票降價就通知你",
        body: "設定航線與目標價；票價降至你的預算時，我們會寄送 Email 通知。",
        routeWatch: "航線追蹤",
        live: "即時",
        priceSignal: "票價訊號",
        preview: "追蹤下一個值得把握的好票價。",
        kicker: "海平面下的訊號",
        title: "一個安靜訊號，迎來更好的起飛時機。",
        footer: "持續看著天際線。",
      }
    : {
        signal: "TPE / live fare signal",
        signIn: "Sign in",
        eyebrow: "Departing Taipei · Tokyo / Seoul",
        subtitle: "Set a route and target fare. We’ll notify you when prices drop.",
        body: "Set a route and a target price — we email you when the fare drops. Follow the signal, then take off.",
        routeWatch: "Route watch",
        live: "Live",
        priceSignal: "Price signal",
        preview: "Watch the horizon for a fare worth catching.",
        kicker: "The signal beneath the surface",
        title: "One quiet signal. A better time to fly.",
        footer: "Keep your eyes on the horizon.",
      };
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
          <div className="flex items-center gap-3">
            <span className="header-signal hidden sm:inline-flex">{copy.signal}</span>
            <LanguageToggle />
            <Button asChild size="sm" className="header-cta">
              <Link to="/sign-in">{copy.signIn}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-surface">
          <div className="mx-auto max-w-6xl px-5">
            <div className="hero-content">
              <Reveal>
                <div className="eyebrow-chip">{copy.eyebrow}</div>
                <h1 className="hero-title">
                  Flight Price
                  <br />
                  <span className="title-outline">Notifier</span>
                </h1>
                <p className="hero-subtitle">{copy.subtitle}</p>
                <p className="hero-copy">{copy.body}</p>
                <div className="hero-actions">
                  <Button asChild size="lg" className="solar-button">
                    <Link to="/sign-in">{copy.signIn}</Link>
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={180}>
                <div className="hero-orbit-card" aria-label="Live route signal preview">
                  <div className="orbit-card-top">
                    <span>{copy.routeWatch}</span>
                    <strong>{copy.live}</strong>
                  </div>
                  <div className="orbit-visual" aria-hidden="true">
                    <div className="orbit-globe">✦</div>
                  </div>
                  <div className="orbit-card-bottom">
                    <span>TPE / NRT</span>
                    <span>{copy.priceSignal}</span>
                  </div>
                  <div className="signal-line" />
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {copy.preview}
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <p className="section-kicker">{copy.kicker}</p>
              <h2 className="section-title">{copy.title}</h2>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Reveal key={f.en.title} delay={i * 120}>
                  <article className="feature-card h-full">
                    <div className="feature-index">0{i + 1} / 03</div>
                    <div className="feature-icon">
                      <f.icon className="size-5" />
                    </div>
                    <h2>
                      {isChinese ? f.zh.title : f.en.title}
                      <span>{isChinese ? f.zh.label : f.en.label}</span>
                    </h2>
                    <p className="mt-3 text-sm">{isChinese ? f.zh.body : f.en.body}</p>
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
          <span>© 2026 Flight Price Notifier · {copy.footer}</span>
        </div>
      </footer>
    </div>
  );
}
