import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/language";
import { useLanguage } from "@/lib/language";

type AuthMode = "signin" | "signup";

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isChinese = locale === "zh-TW";
  const copy = isChinese
    ? {
        back: "← 回到 Flight Price Notifier",
        eyebrow: "安全的航班價格通知",
        signIn: "登入",
        signUp: "註冊",
        description: mode === "signin" ? "使用 Email 與密碼登入。" : "使用 Email 與密碼建立帳號。",
        password: "密碼",
        wait: "請稍候…",
        missingAccount: "還沒有帳號？前往註冊",
        existingAccount: "已經有帳號？前往登入",
        confirm: "請先到信箱確認帳號後再登入。",
      }
    : {
        back: "← Back to Flight Price Notifier",
        eyebrow: "Secure flight signal",
        signIn: "Sign in",
        signUp: "Sign up",
        description:
          mode === "signin"
            ? "Sign in with your email and password."
            : "Create an account with your email and password.",
        password: "Password",
        wait: "Please wait…",
        missingAccount: "New here? Create an account",
        existingAccount: "Already have an account? Sign in",
        confirm: "Check your inbox to confirm your account, then sign in.",
      };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/app", { replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/app` },
          });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate("/app", { replace: true });
    else setError(copy.confirm);
  }

  return (
    <div className="auth-surface flex items-center justify-center px-5 py-16">
      <div className="auth-content w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <Link to="/" className="auth-back mb-7 block text-center">
          {copy.back}
        </Link>
        <div className="auth-card">
          <div className="eyebrow-chip mb-5">{copy.eyebrow}</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? copy.signIn : copy.signUp}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label className="auth-label" htmlFor="email">
                Email
              </Label>
              <Input
                className="auth-input"
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="auth-label" htmlFor="password">
                {copy.password}
              </Label>
              <Input
                className="auth-input"
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="solar-button auth-submit" disabled={loading}>
              {loading ? copy.wait : mode === "signin" ? copy.signIn : copy.signUp}
            </Button>
          </form>
          <button
            type="button"
            className="auth-switch mt-5 w-full text-center"
            onClick={() => {
              navigate(mode === "signin" ? "/sign-up" : "/sign-in");
              setError(null);
            }}
          >
            {mode === "signin" ? copy.missingAccount : copy.existingAccount}
          </button>
        </div>
      </div>
    </div>
  );
}
