"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLatestAnalysis } from "@/lib/business-api";
import {
  getAiPmBriefing,
  getDashboard,
  getSmartQuestions,
  sendMeetingMessage,
} from "@/lib/api";
import type { AiPmBriefing, MeetingMessage } from "@/lib/types";
import { ChatBubble, ThinkingBubble } from "@/components/meeting/ChatBubble";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage } from "@/components/layout/workspace-page";

function formatRisk(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!n || Number.isNaN(n) || n <= 0) return null;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString()}`;
}

export default function WorkspaceAiPmPage() {
  const params = useParams();
  const businessId = params.business_id as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<AiPmBriefing | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const latest = await getLatestAnalysis(businessId);
        if (!latest.has_analysis || !latest.session_id) {
          setError(
            "No analysis available. Run Decision Center analysis first so the AI PM can use real data."
          );
          return;
        }
        const sid = latest.session_id;
        setSessionId(sid);

        const [briefRes, qs, dash] = await Promise.all([
          getAiPmBriefing(sid),
          getSmartQuestions(sid),
          getDashboard(sid).catch(() => null),
        ]);

        const b = briefRes.briefing;
        setBriefing(b);
        setQuestions(qs);

        const metrics = b?.metrics || {};
        const score = metrics.priority_score;
        const reach = metrics.customer_reach ?? metrics.review_count;
        const risk = formatRisk(metrics.revenue_at_risk ?? metrics.revenue_impact);
        const monologue = [
          `I'm your AI Product Manager for this analysis — grounded in ranked Decision Center data, not generic advice.`,
          "",
          b?.issue
            ? `**Top issue:** ${b.issue}`
            : "**Top issue:** Not ranked yet",
          b?.why_it_matters ? `**Why it matters:** ${b.why_it_matters}` : "",
          b?.why_prioritized ? `**Why prioritized:** ${b.why_prioritized}` : "",
          b?.if_ignored ? `**If ignored:** ${b.if_ignored}` : "",
          b?.recommended_next_action
            ? `**Recommended next action:** ${b.recommended_next_action}`
            : "",
          "",
          `Signals in scope: ${dash?.total_reviews?.toLocaleString?.() || metrics.total_reviews_analysed || "—"} reviews` +
            (reach != null ? ` · reach ${reach}` : "") +
            (score != null ? ` · priority ${score}/100` : "") +
            (risk ? ` · ${risk} at risk` : ""),
          "",
          `Ask a product decision question — priority, trade-offs, what to ship, or what to defer.`,
        ]
          .filter(Boolean)
          .join("\n");

        setMessages([{ role: "ai", content: monologue, timestamp: Date.now() }]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load AI Product Manager");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const sendMessage = async (text: string) => {
    if (!sessionId || !text.trim() || thinking) return;
    const userMsg: MeetingMessage = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const result = await sendMeetingMessage(sessionId, text);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: result.reply,
          referenced_issues: result.referenced_issues,
          timestamp: Date.now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "I couldn't answer from this session's analysis. Try again or reopen the Decision Center.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" label="Loading AI Product Manager…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-2xl mx-auto">
        <EmptyState
          title="AI Product Manager unavailable"
          description={error}
          action={{ label: "Open Decision Center", href: `/business/${businessId}/analysis` }}
        />
      </div>
    );
  }

  const metrics = briefing?.metrics || {};

  return (
    <WorkspacePage>
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Decision assistant · secondary
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          AI Product Manager
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
          Ask product questions grounded in this analysis. Primary decisions still live in the
          Decision Center — this assistant explains priority, trade-offs, and next actions.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/business/${businessId}/roadmap`}>Roadmap</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/business/${businessId}/sprint`}>Sprint</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/business/${businessId}/analysis`}>Decision Center</Link>
          </Button>
        </div>
      </header>

      {briefing && (
        <section className="mb-8 grid md:grid-cols-2 gap-4">
          <BriefCard title="Why it matters" body={briefing.why_it_matters} />
          <BriefCard title="Why prioritized" body={briefing.why_prioritized} />
          <BriefCard title="If ignored" body={briefing.if_ignored} />
          <BriefCard
            title="Recommended next action"
            body={briefing.recommended_next_action}
          />
          <div className="md:col-span-2 rounded-[18px] border border-border bg-surface p-4 flex flex-wrap gap-3">
            {briefing.issue && <Badge variant="warning">{briefing.issue}</Badge>}
            {metrics.priority_score != null && (
              <Badge variant="outline">Priority {String(metrics.priority_score)}/100</Badge>
            )}
            {metrics.customer_reach != null && (
              <Badge variant="outline">Reach {String(metrics.customer_reach)}</Badge>
            )}
            {metrics.severity != null && (
              <Badge variant="outline">Severity {String(metrics.severity)}</Badge>
            )}
            {formatRisk(metrics.revenue_at_risk ?? metrics.revenue_impact) && (
              <Badge variant="danger">
                {formatRisk(metrics.revenue_at_risk ?? metrics.revenue_impact)} at risk
              </Badge>
            )}
          </div>
        </section>
      )}

      <section className="rounded-[20px] border border-border bg-surface overflow-hidden flex flex-col min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 max-h-[52vh]">
          {messages.map((msg, i) => (
            <ChatBubble
              key={i}
              message={msg}
              sessionId={sessionId!}
              index={i}
            />
          ))}
          {thinking && <ThinkingBubble />}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-4 md:p-5 space-y-3">
          {questions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {questions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={thinking}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-[#0E1424] text-slate-400 hover:border-primary/40 hover:text-slate-200 disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage(input)
              }
              placeholder="Ask about priority, trade-offs, or what to ship…"
              disabled={thinking}
              className="flex-1 bg-[#0E1424] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              aria-label="Ask the AI Product Manager"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={thinking || !input.trim()}
              className="shrink-0"
            >
              Send
            </Button>
          </div>
        </div>
      </section>
    </WorkspacePage>
  );
}

function BriefCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-surface p-4 md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600 mb-2">
        {title}
      </p>
      <p className="text-sm text-slate-300 leading-relaxed">{body}</p>
    </div>
  );
}
