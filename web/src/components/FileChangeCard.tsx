import { useLayout } from "./MainLayout";

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
}

interface Props {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

export function FileChangeCard({ files, totalAdditions, totalDeletions }: Props) {
  const { toggleRight } = useLayout();

  return (
    <div
      className="fade-in mx-3 my-2 rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)" }}
    >
      {/* Summary header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {files.length} 个文件已更改
        </span>
        <span className="text-[10px] font-mono">
          <span style={{ color: "var(--accent-green)" }}>+{totalAdditions}</span>{" "}
          <span style={{ color: "var(--accent-red)" }}>-{totalDeletions}</span>
        </span>
      </div>

      {/* File list (max 5) */}
      {files.slice(0, 5).map((file) => (
        <div
          key={file.path}
          className="flex items-center justify-between px-3 py-1.5 border-b last:border-b-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span
            className="text-[11px] truncate flex-1 mr-2"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
          >
            {file.path}
          </span>
          <span className="text-[10px] font-mono shrink-0">
            <span style={{ color: "var(--accent-green)" }}>+{file.additions}</span>{" "}
            <span style={{ color: "var(--accent-red)" }}>-{file.deletions}</span>
          </span>
        </div>
      ))}

      {/* View all button */}
      <button
        onClick={toggleRight}
        className="w-full py-2 text-xs font-medium transition-colors"
        style={{ color: "var(--accent-cyan)", background: "var(--accent-cyan-dim)" }}
      >
        查看变更 →
      </button>
    </div>
  );
}
