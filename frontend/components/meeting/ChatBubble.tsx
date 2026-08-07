import Link from "next/link";
import type { MeetingMessage } from "@/lib/types";

interface ChatBubbleProps {
  message: MeetingMessage;
  sessionId: string;
  index: number;
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => (
    <p key={i} className={line === "" ? "h-2" : ""}>
      {line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
        j % 2 === 1 ? (
          <strong key={j} className="text-white font-bold">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </p>
  ));
}

export function ChatBubble({ message, sessionId, index }: ChatBubbleProps) {
  const isAI = message.role === "ai";

  return (
    <div
      id={`msg-${index}`}
      className={`flex items-start gap-3 animate-fade-in ${isAI ? "" : "flex-row-reverse"}`}
      style={{ animationDelay: `${Math.min(index, 8) * 0.03}s` }}
    >
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
          isAI
            ? "bg-primary text-white"
            : "bg-[#1C2538] border border-white/10 text-slate-300"
        }`}
        aria-hidden
      >
        {isAI ? "AI" : "You"}
      </div>

      <div
        className={`text-sm leading-relaxed max-w-[80%] rounded-2xl px-4 py-3 ${
          isAI
            ? "bg-surface-2 border border-border text-slate-200 rounded-tl-sm"
            : "bg-primary/15 border border-primary/25 text-slate-200 rounded-tr-sm ml-auto"
        }`}
      >
        <div className="space-y-1">{renderMarkdown(message.content)}</div>

        {isAI && message.referenced_issues && message.referenced_issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
            {message.referenced_issues.map((key) => (
              <Link
                key={key}
                href={`/dashboard/${sessionId}/evidence/${key}`}
                className="text-xs px-2 py-0.5 bg-primary/15 border border-primary/30 rounded text-primary-soft-2 font-mono no-underline hover:bg-primary/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {key}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ThinkingBubble() {
  return (
    <div className="flex items-start gap-3 animate-fade-in" aria-live="polite" aria-label="AI is thinking">
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold bg-primary text-white" aria-hidden>
        AI
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-surface-2 border border-border">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A99FFF] animate-pulse-soft" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#A99FFF] animate-pulse-soft" style={{ animationDelay: "0.15s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#A99FFF] animate-pulse-soft" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>
    </div>
  );
}
