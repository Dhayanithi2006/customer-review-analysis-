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
        j % 2 === 1 ? <strong key={j} className="text-slate-100 font-bold">{part}</strong> : part
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
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-base ${
        isAI
          ? "bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
          : "bg-[#1e2235] border border-white/10"
      }`}>
        {isAI ? "🤖" : "👤"}
      </div>

      {/* Bubble */}
      <div
        className={`text-sm leading-relaxed max-w-[80%] rounded-2xl px-4 py-3 ${
          isAI
            ? "bg-[#161827] border border-white/7 rounded-tl-sm text-slate-300"
            : "bg-gradient-to-br from-indigo-500/20 to-cyan-500/15 border border-indigo-500/25 rounded-tr-sm text-slate-200 ml-auto"
        }`}
      >
        <div className="space-y-0.5">
          {renderMarkdown(message.content)}
        </div>

        {/* Referenced issues */}
        {message.referenced_issues && message.referenced_issues.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-white/10">
            {message.referenced_issues.map(key => (
              <Link
                key={key}
                href={`/dashboard/${sessionId}/evidence/${key}`}
                className="text-xs px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded text-indigo-300 font-mono no-underline hover:bg-indigo-500/25 transition-colors"
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
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-cyan-500">
        🤖
      </div>
      <div className="bg-[#161827] border border-white/7 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 0.15, 0.3].map(delay => (
          <div
            key={delay}
            className="w-2 h-2 rounded-full bg-indigo-400"
            style={{ animation: `bounce 1.2s ease-in-out ${delay}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
