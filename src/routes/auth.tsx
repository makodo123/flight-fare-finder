import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "signin" | "signup";

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    else setError("請先到信箱確認帳號後再登入。");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 block text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Flight Price Notifier
        </Link>
        <div className="rounded-2xl border border-border bg-card p-7">
          <h1 className="text-xl font-semibold">
            {mode === "signin" ? "登入 Sign in" : "註冊 Sign up"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            使用 email 與密碼{mode === "signin" ? "登入" : "建立帳號"}。
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password 密碼</Label>
              <Input
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "請稍候…" : mode === "signin" ? "Sign in / 登入" : "Sign up / 註冊"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              navigate(mode === "signin" ? "/sign-up" : "/sign-in");
              setError(null);
            }}
          >
            {mode === "signin" ? "還沒有帳號？註冊 Sign up" : "已經有帳號？登入 Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
