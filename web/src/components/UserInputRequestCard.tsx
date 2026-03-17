import { useMemo, useState } from "react";
import type { UserInputRequestItem } from "../lib/conversation-types";

interface Props {
  item: UserInputRequestItem;
  onSubmit: (requestId: number, answers: Record<string, string[]>) => void;
  onDeny: (requestId: number) => void;
}

export function UserInputRequestCard({ item, onSubmit, onDeny }: Props) {
  const initialAnswers = useMemo(() => item.answers ?? {}, [item.answers]);
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers);

  const isPending = item.status === "pending";
  const canSubmit = item.questions.every((question) => {
    const values = answers[question.id] ?? [];
    return values.length > 0 && values.some((value) => value.trim().length > 0);
  });

  const setSingleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [value] }));
  };

  return (
    <div
      className="mx-3 my-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: `1px solid ${isPending ? "var(--accent-amber-mid)" : "var(--border-default)"}`,
        opacity: item.status === "denied" ? 0.65 : 1,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: isPending ? "var(--accent-amber)" : "var(--text-secondary)" }}
        >
          User Input Needed
        </span>
      </div>

      <div className="px-3 py-2 space-y-4">
        {item.questions.map((question) => (
          <div key={question.id} className="space-y-2">
            <div>
              <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {question.header}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {question.question}
              </div>
            </div>

            {question.options.length > 0 && (
              <div className="space-y-2">
                {question.options.map((option) => {
                  const selected = (answers[question.id] ?? [])[0] === option.label;
                  return (
                    <button
                      key={`${question.id}-${option.label}`}
                      type="button"
                      onClick={() => setSingleAnswer(question.id, option.label)}
                      className="w-full rounded-lg px-3 py-2 text-left btn-press"
                      style={{
                        background: selected ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
                        color: selected ? "var(--accent-cyan)" : "var(--text-primary)",
                        border: `1px solid ${selected ? "var(--accent-cyan-mid)" : "var(--border-subtle)"}`,
                      }}
                    >
                      <div className="text-xs font-semibold">{option.label}</div>
                      <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {(question.isOther || question.options.length === 0) && (
              <input
                type={question.isSecret ? "password" : "text"}
                value={(answers[question.id] ?? [""])[0] || ""}
                onChange={(event) => setSingleAnswer(question.id, event.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
                placeholder="输入答案"
              />
            )}
          </div>
        ))}
      </div>

      {isPending && item.requestId !== undefined ? (
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            onClick={() => onDeny(item.requestId!)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold btn-press"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--accent-red)",
              border: "1px solid var(--accent-red-dim)",
            }}
          >
            取消
          </button>
          <button
            onClick={() => onSubmit(item.requestId!, answers)}
            disabled={!canSubmit}
            className="flex-1 py-2 rounded-lg text-xs font-semibold btn-press disabled:opacity-40"
            style={{
              background: "var(--accent-cyan)",
              color: "var(--text-inverse)",
            }}
          >
            提交
          </button>
        </div>
      ) : (
        <div
          className="px-3 py-2 text-xs font-medium"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: item.status === "submitted" ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          {item.status === "submitted" ? "Input submitted" : "Input request dismissed"}
        </div>
      )}
    </div>
  );
}
