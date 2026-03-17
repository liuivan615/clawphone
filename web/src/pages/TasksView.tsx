import { useRef, useEffect } from "react";
import type { ConversationItem } from "../lib/conversation-types";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { CommandCallCard } from "../components/CommandCallCard";
import { FileChangeCard } from "../components/FileChangeCard";
import { PermissionRequestCard } from "../components/PermissionRequestCard";
import { ReasoningBlock } from "../components/ReasoningBlock";
import { TaskUpdateCard } from "../components/TaskUpdateCard";
import { UserInputRequestCard } from "../components/UserInputRequestCard";

interface Props {
  items: ConversationItem[];
  turnActive: boolean;
  onApprove?: (requestId: number) => void;
  onDeny?: (requestId: number) => void;
  onApprovePermission?: (requestId: number, scope: "turn" | "session") => void;
  onSubmitUserInput?: (requestId: number, answers: Record<string, string[]>) => void;
}

export function TasksView({
  items,
  turnActive,
  onApprove,
  onDeny,
  onApprovePermission,
  onSubmitUserInput,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, turnActive]);

  if (items.length === 0 && !turnActive) {
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
      {items.map((item) => {
        switch (item.type) {
          case "user_message":
            return (
              <MarkdownMessage
                key={item.id}
                role="user"
                content={item.text}
              />
            );

          case "agent_text":
            return (
              <MarkdownMessage
                key={item.id}
                role="assistant"
                content={item.content}
                isStreaming={item.streaming}
              />
            );

          case "reasoning":
            return (
              <ReasoningBlock key={item.id} item={item} />
            );

          case "task_update":
            return <TaskUpdateCard key={item.id} item={item} />;

          case "command_call":
            return (
              <CommandCallCard
                key={item.id}
                item={item}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            );

          case "file_change":
            return (
              <FileChangeCard
                key={item.id}
                item={item}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            );

          case "permission_request":
            return item.requestId !== undefined ? (
              <PermissionRequestCard
                key={item.id}
                item={item}
                onApprove={(requestId, scope) => onApprovePermission?.(requestId, scope)}
                onDeny={(requestId) => onDeny?.(requestId)}
              />
            ) : null;

          case "user_input_request":
            return item.requestId !== undefined ? (
              <UserInputRequestCard
                key={item.id}
                item={item}
                onSubmit={(requestId, answers) => onSubmitUserInput?.(requestId, answers)}
                onDeny={(requestId) => onDeny?.(requestId)}
              />
            ) : null;

          case "system":
            return (
              <MarkdownMessage
                key={item.id}
                role="system"
                content={item.content}
              />
            );

          default:
            return null;
        }
      })}

      {/* Streaming indicator when turn is active but no streaming items yet */}
      {turnActive && items.length > 0 && !items.some((i) => (i.type === "agent_text" && i.streaming) || (i.type === "reasoning" && i.streaming)) && (
        <div className="mx-3 my-2 flex items-center gap-2">
          <span className="spinner" />
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Codex 正在处理...</span>
        </div>
      )}
    </div>
  );
}
