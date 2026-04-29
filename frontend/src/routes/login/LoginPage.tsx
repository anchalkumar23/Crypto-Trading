import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, TrendingUp } from "lucide-react";
import { auth, setToken, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await auth.login(email.trim(), password);
      setToken(res.access_token);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "Invalid email or password."
            : `Login failed (${err.status}). Is the backend running?`,
        );
      } else {
        setError("Cannot reach the server. Make sure the backend is running on port 8000.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-brand-gradient grid place-items-center shadow-[0_0_24px_rgba(124,92,255,0.4)]">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-ink">Vega Lab</span>
        </div>

        <div className="card p-8 space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-ink">Sign in</h1>
            <p className="text-xs text-ink-muted mt-1">
              Self-hosted crypto research &amp; paper-trading
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-bear/30 bg-bear-bg p-3 text-xs text-bear leading-relaxed">
                {error}
              </div>
            )}

            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                Email
              </label>
              <Input
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-2xs uppercase tracking-wider text-ink-muted block mb-1.5">
                Password
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-2xs text-ink-subtle text-center leading-relaxed">
            First time? The admin account is created from{" "}
            <code className="text-ink-muted bg-bg-subtle px-1 py-0.5 rounded">
              INITIAL_ADMIN_EMAIL
            </code>{" "}
            and{" "}
            <code className="text-ink-muted bg-bg-subtle px-1 py-0.5 rounded">
              INITIAL_ADMIN_PASSWORD
            </code>{" "}
            in your <code className="text-ink-muted bg-bg-subtle px-1 py-0.5 rounded">.env</code>.
          </p>
        </div>

        <p className="text-center text-2xs text-ink-subtle mt-6 leading-relaxed">
          Paper trading only · No real orders without explicit activation
        </p>
      </div>
    </div>
  );
}
