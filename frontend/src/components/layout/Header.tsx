// Top navigation bar. Mirrors the header from the original Flask
// base.html — Sewanee purple background, gold "ST" mark, desktop nav
// links, mobile hamburger panel.
//
// Auth-aware bits (signed-in avatar, role badge, mode switcher) are
// stubbed for now and filled in during commit 3 when AuthContext lands.
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/map", label: "Live Map" },
  { to: "/schedule", label: "Schedule" },
  { to: "/history", label: "History" },
] as const;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }: { isActive: boolean }) =>
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
        </nav>

        {/* Right side: auth actions (placeholder until commit 3) */}
        <div className="flex items-center gap-2">
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

          {/* Hamburger (mobile only) */}
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

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden bg-sewanee-purple border-t border-white/10 shadow-xl">
          <div className="px-4 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    "block px-4 py-3 rounded-xl font-semibold text-base transition",
                    isActive ? "bg-white/10 text-white" : "text-white hover:bg-white/10"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl text-white font-semibold text-base hover:bg-white/10 transition"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl bg-sewanee-gold text-white font-bold text-center text-base hover:bg-sewanee-gold-light transition"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}