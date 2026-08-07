export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#08090e] gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-pulse" />
      </div>
      <p className="text-sm text-slate-500 animate-pulse">{label}</p>
    </div>
  );
}
