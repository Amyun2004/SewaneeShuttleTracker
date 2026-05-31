// Guards a route subtree. If the user isn't signed in (or lacks the
// required role), we redirect to /login and preserve the intended
// destination so login can bounce them back.
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Role } from "@/api/types";

interface RequireAuthProps {
  children: ReactNode;
  /** If set, the user must have one of these as their active role. */
  roles?: Role[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Brief loading state — prevents a flicker where the protected page
    // renders, then immediately bounces to /login on the same tick.
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-gray-400 font-mono">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.active_role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}