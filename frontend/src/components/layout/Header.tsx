// Top navigation bar — auth-aware.
//
// Signed-out:  Home / Live Map / Schedule / History + Sign in / Create account
// Signed-in:   nav adapts to active_role (drivers see /track instead of /map),
//              right side shows role badge + avatar dropdown with mode switch
//              and sign-out.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Role } from "@/api/types";
import { cn } from "@/lib/cn";

const RIDER_NAV = [
  { to: "/", label: "Home" },
  { to: "/map", label: "Live Map" },
  { to: "/schedule", label: "Schedule" },
  { to: "/history", label: "History" },
] as const;

const DRIVER_NAV = [
  { to: "/track", label: "Drive" },
  { to: "/history", label: "History" },
  { to: "/schedule", label: "Schedule" },
] as const;

function navFor(role: Role | undefined) {
  if (role === "driver") return DRIVER_NAV;
  return RIDER_NAV;
}

function roleBadge(role: Role) {
  if (role === "driver") {
    return { emoji: "🚐", cls: "bg-sewanee-gold/20 text-sewanee-gold" };
  }
  if (role === "admin") {
    return { emoji: "⚙️", cls: "bg-red-500/20 text-red-300" };
  }
  return { emoji: "👤", cls: "bg-white/15 text-white/80" };
}

export function Header() {
  const { user, logout, switchMode } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Close the menus on route change.
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close avatar dropdown on outside click.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [userMenuOpen]);

  const items = navFor(user?.active_role);
  const badge = user ? roleBadge(user.active_role) : null;

  return (
    <header className="w-full bg-sewanee-purple sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-sewanee-gold rounded-lg flex items-center justify-center text-white font-bold text-sm">
            ST
          </div>
          <span className="text-white font-semibold text-lg tracking-tight hidden sm:inline">
            Sewanee <span className="text-sewanee-gold">Transit</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "text-white bg-white/10"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.active_role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  isActive
                    ? "text-white bg-white/10"
                    : "text-sewanee-gold hover:text-white hover:bg-white/10"
                )
              }
            >
              ⚙ Admin
            </NavLink>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user && badge ? (
            <>
              <span
                className={cn(
                  "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                  "text-[10px] font-bold uppercase tracking-wider",
                  badge.cls
                )}
              >
                <span>{badge.emoji}</span>
                {user.active_role}
              </span>

              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition"
                >
                  <span className="text-white/90 text-sm font-medium">
                    {user.full_name.split(" ")[0]}
                  </span>
                  <span className="w-9 h-9 bg-sewanee-gold rounded-lg flex items-center justify-center font-bold text-white text-sm">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        @{user.username}
                      </p>
                    </div>

                    {user.all_roles.length > 1 && (
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                          Switch mode
                        </p>
                        {(["rider", "driver", "admin"] as Role[])
                          .filter((r) => user.all_roles.includes(r))
                          .map((r) => {
                            const active = r === user.active_role;
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => !active && switchMode(r)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition",
                                  active
                                    ? "bg-sewanee-purple/5"
                                    : "hover:bg-gray-50"
                                )}
                              >
                                <span className="text-base">
                                  {r === "driver" ? "🚐" : r === "admin" ? "⚙️" : "👤"}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs capitalize",
                                    active
                                      ? "font-bold text-sewanee-purple"
                                      : "font-medium text-gray-700"
                                  )}
                                >
                                  {r}
                                </span>
                                {active && (
                                  <span className="ml-auto text-[10px] text-sewanee-purple font-bold">
                                    ACTIVE
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => logout()}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden md:inline-block px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white transition"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="hidden md:inline-block px-4 py-1.5 bg-sewanee-gold hover:bg-sewanee-gold-light text-white text-sm font-bold rounded-lg transition"
              >
                Create account
              </Link>
            </>
          )}

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition text-white"
          >
            {mobileOpen ? (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-sewanee-purple border-t border-white/10 shadow-xl">
          <div className="px-4 py-4 space-y-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "block px-4 py-3 rounded-xl font-semibold text-base transition",
                    isActive ? "bg-white/10 text-white" : "text-white hover:bg-white/10"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user?.active_role === "admin" && (
              <NavLink
                to="/admin"
                className="block px-4 py-3 rounded-xl text-sewanee-gold font-bold text-base hover:bg-white/10 transition"
              >
                ⚙ Admin Dashboard
              </NavLink>
            )}

            <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
              {user ? (
                <>
                  <div className="px-4 py-2">
                    <p className="text-xs text-white/50 uppercase tracking-wider font-bold">
                      Signed in as
                    </p>
                    <p className="text-white font-bold text-sm mt-0.5">{user.full_name}</p>
                    <p className="text-white/50 text-xs">
                      @{user.username} · {user.active_role}
                    </p>
                  </div>
                  {user.all_roles.length > 1 && (
                    <div className="px-4 py-2">
                      <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">
                        Switch mode
                      </p>
                      {(["rider", "driver", "admin"] as Role[])
                        .filter(
                          (r) =>
                            user.all_roles.includes(r) && r !== user.active_role
                        )
                        .map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => switchMode(r)}
                            className="w-full text-left block px-3 py-2 rounded-lg text-white/90 text-sm font-medium hover:bg-white/10 transition"
                          >
                            {r === "driver" ? "🚐" : r === "admin" ? "⚙️" : "👤"}{" "}
                            Switch to {r}
                          </button>
                        ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="block w-full text-left px-4 py-3 mt-2 rounded-xl text-red-300 font-semibold text-base hover:bg-red-500/10 transition"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block px-4 py-3 rounded-xl text-white font-semibold text-base hover:bg-white/10 transition"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block px-4 py-3 mt-2 rounded-xl bg-sewanee-gold text-white font-bold text-center text-base hover:bg-sewanee-gold-light transition"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}