import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium btn-press transition-all"
          style={{
            background: copied ? "var(--accent-green-dim)" : "var(--bg-tertiary)",
            color: copied ? "var(--accent-green)" : "var(--text-tertiary)",
          }}
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5l2.5 2.5L8 3" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
                <path d="M7 3V2a1 1 0 00-1-1H2a1 1 0 00-1 1v4a1 1 0 001 1h1" />
              </svg>
              复制
            </>
          )}
        </button>
      </div>
      {/* Code content with syntax highlighting */}
      {lang ? (
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "12px",
            background: "transparent",
            fontSize: "12px",
            lineHeight: "1.6",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}
        >
          {children.trim()}
        </SyntaxHighlighter>
      ) : (
        <pre className="px-3 py-2.5 overflow-x-auto text-[12px] leading-relaxed" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
          <code>{children}</code>
        </pre>
      )}
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 rounded text-[12px]"
      style={{
        background: "var(--bg-tertiary)",
        color: "var(--accent-cyan)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </code>
  );
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
      <div className="msg-enter flex justify-end px-4 py-3">
        <div
          className="max-w-[85%] px-5 py-3 text-[15px]"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            borderRadius: "0",
            borderRight: "2px solid var(--accent-cyan)",
          }}
        >
          <p className="whitespace-pre-wrap leading-relaxed font-serif text-base">{content}</p>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="msg-enter px-4 py-2">
      <div
        className="max-w-full px-2 py-4 text-[15px]"
        style={{
          background: "transparent",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="prose-ide leading-relaxed">
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const isBlock = className?.startsWith("language-") || String(children).includes("\n");
                if (isBlock) {
                  return <CodeBlock className={className}>{String(children)}</CodeBlock>;
                }
                return <InlineCode {...props}>{children}</InlineCode>;
              },
              pre({ children }) {
                // ReactMarkdown wraps code blocks in <pre><code>
                // We handle it in the code component, so just pass through
                return <>{children}</>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
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
