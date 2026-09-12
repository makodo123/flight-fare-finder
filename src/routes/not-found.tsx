import { Link } from "react-router-dom";
import { LanguageToggle } from "@/components/language";
import { useLanguage } from "@/lib/language";

export default function NotFound() {
  const { locale } = useLanguage();
  const isChinese = locale === "zh-TW";
  return (
    <div className="not-found-surface px-4 text-center">
      <div className="not-found-language">
        <LanguageToggle />
      </div>
      <div className="max-w-md text-center">
        <div className="eyebrow-chip mx-auto">{isChinese ? "訊號遺失" : "Signal lost"}</div>
        <h1 className="mt-7 text-7xl font-bold tracking-[-0.08em] text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {isChinese ? "找不到此頁面" : "Page not found"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChinese
            ? "你要找的頁面不存在，或已被移動。"
            : "The page you’re looking for doesn’t exist or has been moved."}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="solar-button inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition-transform"
          >
            {isChinese ? "回到首頁" : "Go home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
