// Phase-2 commit 1: minimal hello page that proves the build chain,
// Tailwind tokens, and the brand font are all wired correctly.
// Real routing + pages land in the next commit.
export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sewanee-navy text-white px-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-sewanee-gold rounded-lg flex items-center justify-center font-bold text-white">
          ST
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Sewanee <span className="text-sewanee-gold">Transit</span>
        </h1>
      </div>
      <p className="text-white/70 text-sm">Frontend scaffolding online.</p>
      <p className="text-white/40 text-xs mt-2 font-mono">
        Vite · React · TypeScript · Tailwind v4
      </p>
    </div>
  );
}