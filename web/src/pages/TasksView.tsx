import { useRef, useEffect } from "react";
import { MarkdownMessage } from "../components/MarkdownMessage";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

export function TasksView({ messages, streamingContent, isStreaming }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div
          className="text-5xl font-bold mb-4"
          style={{ color: "var(--accent-cyan)", opacity: 0.15, fontFamily: "var(--font-mono)" }}
        >
          CP
        </div>
        <p className="text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
          让 Codex 帮你构建、修复或解释项目中的任何内容
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
      {messages.map((msg) => (
        <MarkdownMessage key={msg.id} role={msg.role} content={msg.content} />
      ))}
      {isStreaming && streamingContent && (
        <MarkdownMessage role="assistant" content={streamingContent} isStreaming />
      )}
    </div>
  );
}
