import { useState } from "react";
import { postApi } from "../hooks/use-api";
import { tr } from "../lib/app-language";
import { InkosLogo } from "../components/InkosLogo";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export function LoginPage({ onSuccess }: { readonly onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await postApi("/auth/login", { password });
      onSuccess();
    } catch {
      setError(tr("密码错误，请重试。", "Incorrect password. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <InkosLogo className="w-12 h-12 mb-4" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-3xl italic text-primary">Ink</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">OS</span>
          </div>
          <div className="text-xs text-muted-foreground tracking-widest uppercase mt-1">Studio</div>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              {tr("管理密码", "Admin password")}
            </label>
            <Input
              id="login-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={tr("输入 INKOS_STUDIO_PASSWORD", "Enter INKOS_STUDIO_PASSWORD")}
              className="h-10"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={!password || submitting}
            className="w-full h-10"
          >
            {submitting ? tr("登录中…", "Signing in…") : tr("登录", "Sign in")}
          </Button>
        </form>
      </div>
    </div>
  );
}
