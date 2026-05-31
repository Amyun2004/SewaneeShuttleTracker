// Minimal site footer matching the original Flask templates.
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="w-full bg-sewanee-purple text-white/60 text-xs py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
        <span>© 2026 Sewanee Transit · University of the South</span>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-white transition">
            Privacy
          </Link>
          <a href="mailto:spo@sewanee.edu" className="hover:text-white transition">
            Contact SPO
          </a>
        </div>
      </div>
    </footer>
  );
}