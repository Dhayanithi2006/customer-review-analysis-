"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDashboard, getSmartQuestions, sendMeetingMessage } from "@/lib/api";
import type { MeetingMessage, DashboardData } from "@/lib/types";
import { Navbar } from "@/components/shared/Navbar";
import { ChatBubble, ThinkingBubble } from "@/components/meeting/ChatBubble";
import { PageLoader } from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";

export default function MeetingPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [messages, setMessages]   = useState<MeetingMessage[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [thinking, setThinking]   = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  // Load dashboard + smart questions + build opening monologue
  useEffect(() => {
    Promise.all([getDashboard(sessionId), getSmartQuestions(sessionId)])
      .then(([dash, qs]) => {
        setDashboard(dash);
        setQuestions(qs);

        const topIssues = dash.issues.slice(0, 3);
        const monologue = [
          `Good morning. I've analysed **${dash.total_reviews.toLocaleString()}** customer reviews for your product.`,
          "",
          `**Top 3 priorities:**`,
          ...topIssues.map((issue, i) =>
            `${i + 1}. **${issue.issue_key.replace(/_/g, " ")}** — ${issue.review_count} reviews${issue.revenue_at_risk > 0 ? `, ₹${(issue.revenue_at_risk / 1000).toFixed(0)}K at risk` : ""}`
          ),
          "",
          `**Your most urgent action:** ${dash.ai_recommendation || "Review the priority list on the dashboard."}`,
          "",
          `What would you like to explore?`,
        ].join("\n");

        setMessages([{ role: "ai", content: monologue, timestamp: Date.now() }]);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: MeetingMessage = { role: "user", content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const result = await sendMeetingMessage(sessionId, text);
      setMessages(prev => [...prev, {
        role: "ai",
        content: result.reply,
        referenced_issues: result.referenced_issues,
        timestamp: Date.now(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "ai",
        content: "I encountered an error processing your question. Please try again.",
        timestamp: Date.now(),
      }]);
    } finally {
      setThinking(false);
    }
  };

  if (loading) return <PageLoader label="Preparing your AI meeting…" />;

  return (
    <div className="min-h-screen flex flex-col bg-[#08090e]">
      <Navbar
        backHref={`/dashboard/${sessionId}`}
        backLabel="Dashboard"
        title="AI Product Review Meeting"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-semibold hidden sm:block">Live</span>
            </div>
            {dashboard && (
              <span className="text-xs text-slate-500 hidden md:block">
                {dashboard.total_reviews.toLocaleString()} reviews analysed
              </span>
            )}
          </div>
        }
      />

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto max-w-2xl px-4">
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} sessionId={sessionId} index={i} />
            ))}

            {thinking && <ThinkingBubble />}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-white/7 bg-[#08090e]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Smart question chips */}
          {questions.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {questions.map((q, i) => (
                <button
                  key={i}
                  id={`chip-${i}`}
                  onClick={() => sendMessage(q)}
                  disabled={thinking}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-[#161827] text-slate-400 hover:border-indigo-500/40 hover:text-slate-200 hover:bg-indigo-500/8 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2">
            <input
              id="meeting-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask anything about your product data…"
              disabled={thinking}
              className="flex-1 bg-[#161827] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all disabled:opacity-50"
            />
            <Button
              id="btn-send-message"
              onClick={() => sendMessage(input)}
              disabled={thinking || !input.trim()}
              className="shrink-0"
            >
              {thinking ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : "Send"}
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-slate-600">Press Enter to send · Shift+Enter for new line</p>
            <Link
              href={`/dashboard/${sessionId}`}
              className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors no-underline"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
