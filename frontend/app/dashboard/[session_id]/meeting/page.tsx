"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDashboard, getSmartQuestions, sendMeetingMessage } from "@/lib/api";
import type { MeetingMessage, DashboardData } from "@/lib/types";

export default function MeetingPage() {
  const params    = useParams();
  const sessionId = params.session_id as string;

  const [dashboard, setDashboard]     = useState<DashboardData | null>(null);
  const [questions, setQuestions]     = useState<string[]>([]);
  const [messages, setMessages]       = useState<MeetingMessage[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(true);
  const [thinking, setThinking]       = useState(false);
  const bottomRef                     = useRef<HTMLDivElement>(null);

  // Load dashboard + smart questions + build opening monologue
  useEffect(() => {
    Promise.all([getDashboard(sessionId), getSmartQuestions(sessionId)])
      .then(([dash, qs]) => {
        setDashboard(dash);
        setQuestions(qs);

        // Build opening monologue from dashboard data
        const topIssues = dash.issues.slice(0, 3);
        const monologue = [
          `Good morning. I've analysed **${dash.total_reviews.toLocaleString()}** customer reviews for your product.`,
          "",
          `**Top 3 priorities:**`,
          ...topIssues.map((issue, i) =>
            `${i + 1}. **${issue.issue_key.replace(/_/g, " ")}** — ${issue.review_count} reviews${issue.revenue_at_risk > 0 ? `, ₹${(issue.revenue_at_risk/1000).toFixed(0)}K at risk` : ""}`
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

  const renderContent = (text: string) => {
    // Simple markdown: **bold**, newlines
    return text.split("\n").map((line, i) => (
      <p key={i} style={{ margin: line === "" ? "0.5rem 0" : "0" }}>
        {line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
      </p>
    ));
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* ── Nav ── */}
      <nav className="nav" style={{ flexShrink: 0 }}>
        <div className="container" style={{ padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href={`/dashboard/${sessionId}`} className="btn btn-outline btn-sm" id="btn-back-from-meeting">← Dashboard</Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)", boxShadow: "0 0 6px var(--color-success)" }} className="animate-pulse-glow" />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>AI Product Review Meeting</span>
            </div>
          </div>
          {dashboard && (
            <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
              {dashboard.total_reviews.toLocaleString()} reviews analysed
            </span>
          )}
        </div>
      </nav>

      {/* ── Chat Area ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2rem 0" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {messages.map((msg, i) => (
              <div key={i} className="animate-fade-in" style={{
                display: "flex",
                flexDirection: msg.role === "ai" ? "row" : "row-reverse",
                alignItems: "flex-start",
                gap: "0.875rem",
              }} id={`msg-${i}`}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: msg.role === "ai" ? "var(--gradient-brand)" : "var(--color-surface-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                }}>
                  {msg.role === "ai" ? "🤖" : "👤"}
                </div>

                {/* Bubble */}
                <div className={msg.role === "ai" ? "bubble-ai" : "bubble-user"}
                  style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>
                  {renderContent(msg.content)}
                  {msg.referenced_issues && msg.referenced_issues.length > 0 && (
                    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                      {msg.referenced_issues.map(key => (
                        <Link
                          key={key}
                          href={`/dashboard/${sessionId}/evidence/${key}`}
                          style={{
                            fontSize: "0.73rem", padding: "0.2rem 0.5rem",
                            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                            borderRadius: 4, color: "var(--color-primary-glow)",
                            textDecoration: "none", fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {key}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {thinking && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🤖</div>
                <div className="bubble-ai" style={{ display: "flex", gap: "4px", alignItems: "center", padding: "1rem 1.25rem" }}>
                  {[0, 0.2, 0.4].map(delay => (
                    <div key={delay} style={{
                      width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary-glow)",
                      animation: "pulse-glow 1.4s ease-in-out infinite",
                      animationDelay: `${delay}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* ── Smart Questions + Input ── */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--color-border)", background: "rgba(8,9,14,0.9)", backdropFilter: "blur(20px)", padding: "1rem 0" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          {/* Question chips */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.875rem", overflowX: "auto" }}>
            {questions.map((q, i) => (
              <button
                key={i}
                className="question-chip"
                onClick={() => sendMessage(q)}
                disabled={thinking}
                id={`chip-${i}`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask anything about your product data…"
              disabled={thinking}
              id="meeting-input"
            />
            <button
              className="btn btn-primary"
              onClick={() => sendMessage(input)}
              disabled={thinking || !input.trim()}
              id="btn-send-message"
              style={{ flexShrink: 0, opacity: thinking || !input.trim() ? 0.5 : 1 }}
            >
              {thinking ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
