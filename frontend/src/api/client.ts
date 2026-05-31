// Single source of truth for talking to the FastAPI backend.
//
// Why hand-rolled instead of axios:
//   - One file, no extra dep.
//   - We need exactly two behaviors axios would also need configuring for:
//       1. `credentials: 'include'` so the HttpOnly auth cookies the
//          backend sets at /api/auth/login ride along on every request.
//       2. A 401-aware error so the AuthContext can clear stale state
//          when a session expires.
//   - In dev, Vite's proxy (vite.config.ts) maps /api/* to localhost:8000,
//     so we use relative URLs everywhere. In prod, point VITE_API_BASE at
//     the deployed FastAPI origin.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: unknown,
    message?: string
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = "ApiError";
  }

  /** True when the server says "you're not logged in" or "you're logged in
   *  but lack the required role." Used by AuthContext to invalidate the
   *  cached user. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** If provided, sent as JSON. Don't set Content-Type manually. */
  json?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = opts;

  const init: RequestInit = {
    credentials: "include",
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  };

  const res = await fetch(`${BASE}${path}`, init);

  if (!res.ok) {
    // Try to parse FastAPI's structured error body; fall back to text.
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, detail, extractMessage(detail) ?? res.statusText);
  }

  // 204 No Content — common for logout, delete, etc.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function extractMessage(detail: unknown): string | null {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail !== null && "detail" in detail) {
    const d = (detail as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return null;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", json }),
  patch: <T>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", json }),
  del: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};