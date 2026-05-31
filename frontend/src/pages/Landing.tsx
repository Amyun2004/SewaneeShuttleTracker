// Public landing page. Ports the dark-navy hero from the original
// templates/landing.html — gold-pulse pill, big two-line headline
// with the second line in gold, primary/secondary CTAs.
//
// The hero photo (campus-aerial.jpg) and bus-icon brand mark from the
// Flask version aren't here yet — we'll bring those in during the PWA
// commit when we're adding all the static image assets in one pass.
import { Link } from "react-router-dom";

export function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-sewanee-navy">
        {/* Gradient overlay — gives depth + ties the section to the brand purple */}
        <div className="absolute inset-0 bg-gradient-to-b from-sewanee-navy/70 via-sewanee-purple/40 to-sewanee-navy/90" />

        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 text-center">
          {/* Tag pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-sewanee-gold animate-pulse" />
            <span className="text-white/90 text-xs font-semibold uppercase tracking-widest">
              University of the South
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            The Sewanee shuttle,
            <br />
            <span className="text-sewanee-gold">live on your phone.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed mb-10">
            Track every Tiger Transit shuttle in real time. See which one is closest, when it'll
            reach your stop, and where it's been, without standing in the cold guessing.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-sewanee-gold hover:bg-sewanee-gold-light text-white font-bold text-sm transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create an account
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-bold text-sm transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            emoji="📍"
            title="Live map"
            body="Every in-service shuttle on a Leaflet map, refreshed in real time over WebSockets."
          />
          <FeatureCard
            emoji="⏰"
            title="Schedule"
            body="See active routes and ordered stop lists, with expected minutes from start."
          />
          <FeatureCard
            emoji="📊"
            title="History"
            body="Filter past trips by date, route, and shuttle. Each trip's GPS trace overlaid on the map."
          />
        </div>
      </section>
    </>
  );
}

interface FeatureCardProps {
  emoji: string;
  title: string;
  body: string;
}

function FeatureCard({ emoji, title, body }: FeatureCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}