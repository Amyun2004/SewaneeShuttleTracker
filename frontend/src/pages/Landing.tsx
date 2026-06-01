// `/` — public landing for anonymous visitors, signed-in home for
// everyone else.
//
// Routing decisions:
//   - anonymous              → marketing hero
//   - active_role=driver     → redirect to /track
//   - active_role=rider/admin → signed-in home with alerts + nearest shuttle
//
// Admins see the same home as riders but get inline edit/delete on alerts.
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { PublicHero } from "@/components/landing/PublicHero";
import { SignedInHome } from "@/components/landing/SignedInHome";

export function Landing() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-gray-400 font-mono">Loading…</p>
      </div>
    );
  }

  if (!user) return <PublicHero />;
  if (user.active_role === "driver") return <Navigate to="/track" replace />;

  return <SignedInHome isAdmin={user.active_role === "admin"} />;
}