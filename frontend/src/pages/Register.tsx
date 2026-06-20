// Account creation. Same RegisterIn shape as the backend Pydantic schema.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { RegisterRole } from "@/api/types";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

const ROLE_OPTIONS: { value: RegisterRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
  { value: "driver", label: "Driver" },
];

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [role, setRole] = useState<RegisterRole>("student");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("You must agree to the terms to create an account.");
      return;
    }
    setSubmitting(true);
    try {
      await register({ ...form, role, terms: agreed });
      nav("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Registration failed.");
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
        <p className="text-sm text-gray-500 mb-6">
          One Sewanee Transit account works for riding, driving, and admin.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="first_name"
              label="First name"
              autoComplete="given-name"
              required
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
            <Input
              name="last_name"
              label="Last name"
              autoComplete="family-name"
              required
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </div>
          <Input
            name="username"
            label="Username"
            hint="Start with a letter, end with a number. Letters, numbers, and underscores only (4–32 chars)."
            required
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
          />
          <Input
            name="email"
            type="email"
            label="Sewanee email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <Input
            name="password"
            type="password"
            label="Password"
            hint="At least 8 chars, with a letter and a number."
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />

          {/* Role */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              I am a
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={cn(
                      "py-2.5 rounded-xl border text-sm font-bold transition",
                      active
                        ? "bg-sewanee-purple text-white border-sewanee-purple shadow-md"
                        : "bg-white border-gray-200 text-gray-700 hover:border-sewanee-purple/40"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-sewanee-purple"
            />
            <span>
              I agree to the Sewanee Transit terms of service and acknowledge the
              privacy policy.
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-sewanee-gold hover:bg-sewanee-gold-light",
              "text-white font-bold text-sm transition",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-sewanee-purple font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}