/**
 * Landing-page product previews — illustrative chrome matching the live product language.
 */

function Sparkline({
  color,
  points,
}: {
  color: string;
  points: string;
}) {
  return (
    <svg viewBox="0 0 64 24" className="w-full h-6" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function DecisionCenterMock() {
  const nav = [
    { label: "Overview", active: true },
    { label: "Issues" },
    { label: "Feedback" },
    { label: "Roadmap" },
    { label: "Sprints" },
    { label: "AI Review" },
    { label: "Exports" },
    { label: "Settings" },
  ];

  const metrics = [
    {
      label: "Revenue at Risk",
      value: "₹2.84L",
      delta: "▼ 24% vs last month",
      deltaTone: "text-red-400",
      spark: "0,18 10,14 18,16 28,10 38,12 48,6 64,8",
      sparkColor: "#F87171",
    },
    {
      label: "Critical Issues",
      value: "18",
      delta: "3 new this week",
      deltaTone: "text-amber-400",
      spark: "0,8 12,10 22,7 34,12 46,9 64,14",
      sparkColor: "#FBBF24",
    },
    {
      label: "Total Reviews",
      value: "2,041",
      delta: "▲ 12% this week",
      deltaTone: "text-emerald-400",
      spark: "0,16 14,14 24,12 36,10 48,8 64,4",
      sparkColor: "#34D399",
    },
    {
      label: "Avg. Confidence",
      value: "94%",
      delta: "High signal quality",
      deltaTone: "text-primary-soft",
      spark: "0,12 16,11 28,10 40,9 52,8 64,7",
      sparkColor: "#A99FFF",
    },
  ];

  const issues = [
    {
      title: "Payment Failure",
      sub: "Checkout · Bug cluster",
      impact: "₹1.42L",
      pct: "50%",
      reviews: "623",
      priority: "Critical",
      priorityClass: "bg-red-500/15 text-red-400 border-red-500/25",
      spark: "0,16 12,14 24,18 36,10 48,12 64,6",
      sparkColor: "#F87171",
    },
    {
      title: "Login Timeout",
      sub: "Auth · Performance",
      impact: "₹68K",
      pct: "24%",
      reviews: "318",
      priority: "High",
      priorityClass: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      spark: "0,10 14,12 26,9 40,14 52,11 64,13",
      sparkColor: "#FBBF24",
    },
    {
      title: "Sync Delay",
      sub: "Library · Reliability",
      impact: "₹41K",
      pct: "14%",
      reviews: "204",
      priority: "Medium",
      priorityClass: "bg-primary/15 text-primary-soft border-primary/25",
      spark: "0,12 16,11 28,13 42,10 54,12 64,11",
      sparkColor: "#A99FFF",
    },
  ];

  return (
    <div className="relative">
      <div
        className="absolute -inset-6 sm:-inset-10 rounded-[32px] opacity-70 blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 55% 35%, rgba(109,93,246,0.28), transparent 62%)",
        }}
        aria-hidden
      />

      <div className="relative rounded-[20px] border border-white/[0.1] bg-[#0E1424] shadow-[0_28px_80px_rgba(0,0,0,0.55)] overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background/90">
          <div className="flex gap-1.5" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-1 rounded-lg bg-white/[0.04] border border-border text-[10px] text-slate-500 font-mono truncate max-w-[260px]">
              app.roadmapai · Decision Center
            </div>
          </div>
        </div>

        <div className="flex min-h-[420px] max-h-[520px]">
          {/* Sidebar */}
          <aside className="hidden md:flex w-[148px] shrink-0 flex-col border-r border-border bg-background py-4 px-2.5">
            <div className="px-2 mb-4">
              <p className="text-[10px] font-bold text-white tracking-tight">RoadmapAI</p>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">Spotify (Play Store)</p>
            </div>
            <nav className="space-y-0.5" aria-hidden>
              {nav.map((item) => (
                <div
                  key={item.label}
                  className={`px-2.5 py-2 rounded-lg text-[11px] font-medium ${
                    item.active
                      ? "bg-primary text-white shadow-[0_4px_14px_rgba(109,93,246,0.28)]"
                      : "text-slate-500"
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0 flex flex-col bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border">
              <div>
                <p className="text-sm font-bold text-white">Overview</p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Last updated: 2 min ago
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:block px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-surface-2 text-[10px] text-slate-300">
                  Spotify (Play Store)
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-primary text-[10px] font-semibold text-white">
                  + New Analysis
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-3 sm:p-4 space-y-3">
              {/* Metrics */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                {metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-border bg-surface-2 p-2.5 sm:p-3"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold truncate">
                      {m.label}
                    </p>
                    <p className="text-base sm:text-lg font-extrabold font-mono text-white mt-1 tracking-tight">
                      {m.value}
                    </p>
                    <div className="mt-1.5 opacity-90">
                      <Sparkline color={m.sparkColor} points={m.spark} />
                    </div>
                    <p className={`text-[10px] mt-1 ${m.deltaTone}`}>{m.delta}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-[1fr_160px] gap-2.5 min-h-0">
                {/* Issues table */}
                <div className="rounded-xl border border-border bg-[#0E1424]/80 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-200">
                      Top Issues by Revenue Impact
                    </p>
                    <p className="text-[10px] text-slate-500">Sorted by risk</p>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    <div className="hidden sm:grid grid-cols-[1.4fr_0.7fr_0.5fr_0.6fr_0.5fr] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
                      <span>Issue</span>
                      <span>Impact</span>
                      <span>Reviews</span>
                      <span>Priority</span>
                      <span>Trend</span>
                    </div>
                    {issues.map((issue) => (
                      <div
                        key={issue.title}
                        className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.7fr_0.5fr_0.6fr_0.5fr] gap-2 px-3 py-2.5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-100 truncate">
                            {issue.title}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{issue.sub}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold font-mono text-red-400">
                            {issue.impact}
                          </p>
                          <p className="text-[10px] text-slate-500">{issue.pct}</p>
                        </div>
                        <p className="text-[11px] font-mono text-slate-300">{issue.reviews}</p>
                        <span
                          className={`w-fit text-[10px] font-semibold px-2 py-0.5 rounded-md border ${issue.priorityClass}`}
                        >
                          {issue.priority}
                        </span>
                        <div className="hidden sm:block opacity-90">
                          <Sparkline color={issue.sparkColor} points={issue.spark} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI recommendation */}
                <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/15 to-[#161E2E] p-3 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-[10px] text-white font-bold">
                      AI
                    </span>
                    <p className="text-[10px] font-bold text-primary-soft-2 uppercase tracking-wider">
                      Recommendation
                    </p>
                  </div>
                  <p className="text-[12px] font-bold text-white leading-snug mb-2">
                    Focus on fixing Payment Failure first
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
                    Why? Highest revenue at risk with strong evidence density across checkout reviews.
                  </p>
                  <div className="mt-auto py-2 text-center rounded-lg bg-primary text-[10px] font-semibold text-white">
                    Start AI Review →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedbackFlowIllustration() {
  const stages = [
    { title: "Ingest", desc: "Reviews, tickets, CSVs" },
    { title: "Normalize", desc: "One review schema" },
    { title: "Cluster", desc: "Same problem, one issue" },
    { title: "Score", desc: "Revenue at risk" },
    { title: "Decide", desc: "Ranked next actions" },
  ];

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="min-w-[720px] flex items-stretch gap-3">
        {stages.map((stage, i) => (
          <div key={stage.title} className="flex items-center gap-3 flex-1">
            <div className="flex-1 rounded-[18px] border border-border bg-surface p-5 shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-xl bg-primary/15 border border-primary/25 text-primary-soft text-[10px] font-bold flex items-center justify-center">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm font-bold text-white">{stage.title}</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{stage.desc}</p>
            </div>
            {i < stages.length - 1 && (
              <div className="shrink-0 w-6 flex justify-center" aria-hidden>
                <div className="w-6 h-px bg-gradient-to-r from-primary/50 to-transparent" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EngineIllustration() {
  return (
    <div className="rounded-[20px] border border-border bg-surface overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-bold">
            Decision Intelligence Engine
          </p>
          <p className="text-sm font-bold text-white mt-0.5">Deterministic priority pipeline</p>
        </div>
        <span className="text-[10px] font-mono text-slate-500">live</span>
      </div>
      <div className="p-5 grid sm:grid-cols-2 gap-3">
        {[
          { k: "Categorize", v: "Bug · UX · Feature · Perf", s: "Gemini Flash" },
          { k: "Cluster", v: "623 phrases → 1 issue", s: "Similarity graph" },
          { k: "Impact", v: "Severity × volume × ARPU", s: "Revenue model" },
          { k: "Rank", v: "Business impact score", s: "Priority formula" },
        ].map((row) => (
          <div
            key={row.k}
            className="rounded-2xl bg-surface-2 border border-white/[0.05] p-4"
          >
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
              {row.k}
            </p>
            <p className="text-sm font-semibold text-slate-100 mb-1">{row.v}</p>
            <p className="text-[11px] text-primary-soft">{row.s}</p>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-primary-soft-2 uppercase tracking-wider font-bold mb-1">
              Output
            </p>
            <p className="text-sm font-bold text-white">
              Evidence-backed ranked decisions
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-extrabold font-mono text-white">#1</p>
            <p className="text-[10px] text-slate-400">Payment Failure</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RevenueRecoveryIllustration() {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Exposed", value: "₹3.8L/mo", tone: "text-red-400", hint: "Unresolved critical bugs" },
          { label: "Focus", value: "Top 3 issues", tone: "text-amber-400", hint: "Highest recovery leverage" },
          { label: "Recoverable", value: "+18%", tone: "text-emerald-400", hint: "After one sprint cycle" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl bg-surface-2 border border-white/[0.05] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              {m.label}
            </p>
            <p className={`text-2xl font-extrabold font-mono tracking-tight ${m.tone}`}>
              {m.value}
            </p>
            <p className="text-[11px] text-slate-500 mt-2">{m.hint}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">
        Translate frustration into numbers leadership trusts — severity, reach, and revenue in one score.
      </p>
    </div>
  );
}

export function RoadmapIllustration() {
  const weeks = [
    { w: "W1–2", theme: "Stop the bleed", items: "Payment · Auth" },
    { w: "W3–4", theme: "Stabilize core", items: "Sync · Performance" },
    { w: "W5–6", theme: "Unlock growth", items: "Onboarding · UX" },
  ];
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {weeks.map((week, i) => (
        <div
          key={week.w}
          className="rounded-[18px] border border-border bg-surface p-5 shadow-[0_2px_12px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono font-bold text-primary-soft">{week.w}</span>
            <span className="text-[10px] text-slate-600">Phase {i + 1}</span>
          </div>
          <p className="text-base font-bold text-white mb-1">{week.theme}</p>
          <p className="text-xs text-slate-400">{week.items}</p>
        </div>
      ))}
    </div>
  );
}

export function SprintIllustration() {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-5 shadow-[0_2px_12px_rgba(0,0,0,0.28)] space-y-3">
      {[
        { id: "US-01", title: "Retry failed payments with clearer errors", pts: "5" },
        { id: "US-02", title: "Extend auth session for premium users", pts: "3" },
        { id: "US-03", title: "Surface sync status in library view", pts: "2" },
      ].map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.05] bg-surface-2"
        >
          <span className="text-[10px] font-mono text-primary-soft shrink-0">{s.id}</span>
          <p className="text-sm text-slate-200 flex-1 min-w-0 truncate">{s.title}</p>
          <span className="text-[11px] font-bold font-mono text-slate-400">{s.pts} SP</span>
        </div>
      ))}
      <p className="text-[11px] text-slate-500 pt-1">Jira-ready stories · Export as CSV</p>
    </div>
  );
}

export function ArchitectureIllustration() {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-6 shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { t: "Sources", d: "Play Store · CSV · Workspace forms" },
          { t: "Intelligence", d: "Clean · Cluster · Score · Rank" },
          { t: "Decisions", d: "Roadmap · Sprint · Evidence · Export" },
        ].map((layer) => (
          <div key={layer.t} className="rounded-2xl bg-surface-2 border border-white/[0.05] p-4">
            <p className="text-sm font-bold text-white mb-2">{layer.t}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{layer.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
