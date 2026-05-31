// Sign-in form. Mode toggle (rider/staff) maps to backend's LoginIn.mode.
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type Mode = "rider" | "staff";

interface LocationState {
  from?: string;
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("rider");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password, mode });
      nav(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Login failed.");
      } else {
        setError("Network error. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12 md:py-16">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6">
          Sign in to track shuttles, drive a route, or manage the system.
        </p>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-6">
          <ModeButton active={mode === "rider"} onClick={() => setMode("rider")}>
            👤 Rider
          </ModeButton>
          <ModeButton active={mode === "staff"} onClick={() => setMode("staff")}>
            🚐 Driver / Admin
          </ModeButton>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-sewanee-purple hover:bg-sewanee-purple-light",
              "text-white font-bold text-sm transition",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          No account yet?{" "}
          <Link to="/register" className="text-sewanee-purple font-bold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ModeButton({ active, onClick, children }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-lg text-sm font-semibold transition",
        active
          ? "bg-white text-sewanee-purple shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      )}
    >
      {children}
    </button>
  );
}