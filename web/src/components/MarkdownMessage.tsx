import ReactMarkdown from "react-markdown";

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function MarkdownMessage({ role, content, isStreaming }: Props) {
  if (role === "system") {
    return (
      <div className="msg-enter mx-3 my-2">
        <div
          className="px-3.5 py-2.5 rounded-xl text-xs font-medium"
          style={{
            background: "var(--accent-amber-dim)",
            color: "var(--accent-amber)",
            border: "1px solid rgba(251, 191, 36, 0.15)",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="msg-enter flex justify-end px-3 py-1">
        <div
          className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm btn-press"
          style={{
            background: "var(--accent-cyan)",
            color: "var(--text-inverse)",
            boxShadow: "0 2px 8px rgba(34, 211, 238, 0.2)",
          }}
        >
          <p className="whitespace-pre-wrap leading-relaxed font-medium">{content}</p>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="msg-enter px-3 py-1">
      <div
        className="max-w-full rounded-2xl rounded-bl-sm px-4 py-3 text-sm"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="prose-ide leading-relaxed">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {isStreaming && (
          <span
            className="cursor-blink inline-block w-1.5 h-[18px] ml-0.5 align-text-bottom rounded-sm"
            style={{ background: "var(--accent-cyan)" }}
          />
        )}
      </div>
    </div>
  );
}
