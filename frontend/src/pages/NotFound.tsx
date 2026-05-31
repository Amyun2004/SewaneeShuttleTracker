// 404 page. Matches the brand without being heavy.
import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <p className="text-sewanee-gold font-mono font-bold text-sm uppercase tracking-widest mb-3">
        404
      </p>
      <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
        That stop isn't on the route.
      </h1>
      <p className="text-gray-600 mb-8">
        The page you were looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-3 rounded-xl bg-sewanee-purple hover:bg-sewanee-purple-light text-white font-bold text-sm transition"
      >
        Back to home
      </Link>
    </div>
  );
}