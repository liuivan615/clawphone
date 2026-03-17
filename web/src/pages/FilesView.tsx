import { useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";

interface DirEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
}

interface Props {
  workspace: string;
}

export function FilesView({ workspace }: Props) {
  const [currentPath, setCurrentPath] = useState(workspace);
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setFileContent(null);
    setViewingFile(null);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      const data = await res.json();
      setCurrentPath(data.path);
      setDirs(data.dirs || []);

      // Also get files (non-directories)
      const filesRes = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);
      } else {
        setFiles([]);
      }
    } catch {
      setDirs([]);
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDir(workspace);
  }, [workspace, loadDir]);

  const goUp = useCallback(() => {
    const parts = currentPath.replace(/\\$/, "").split("\\");
    if (parts.length <= 1) return;
    parts.pop();
    loadDir(parts.join("\\") + "\\");
  }, [currentPath, loadDir]);

  const viewFile = useCallback(async (filePath: string) => {
    setViewingFile(filePath);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || "");
      } else {
        setFileContent("（无法读取文件）");
      }
    } catch {
      setFileContent("（加载失败）");
    }
  }, []);

  // File viewer
  if (viewingFile && fileContent !== null) {
    const fileName = viewingFile.split("\\").pop() || viewingFile;
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={() => { setViewingFile(null); setFileContent(null); }}
            className="w-7 h-7 flex items-center justify-center rounded-md btn-press"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 3L5 7l4 4" />
            </svg>
          </button>
          <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
            {fileName}
          </span>
        </div>
        <div
          className="flex-1 overflow-auto p-3 text-xs leading-relaxed"
          style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
        >
          <pre className="whitespace-pre-wrap break-all">
            {fileContent.split("\n").map((line, i) => (
              <div key={i} className="flex">
                <span className="select-none pr-3 text-right shrink-0" style={{ color: "var(--text-tertiary)", minWidth: "32px" }}>
                  {i + 1}
                </span>
                <span>{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    );
  }

  // Directory browser
  return (
    <div className="flex flex-col h-full">
      {/* Path bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <button
          onClick={goUp}
          className="w-7 h-7 flex items-center justify-center rounded-md btn-press shrink-0"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 9V3M3 5.5L6 3l3 2.5" />
          </svg>
        </button>
        <span
          className="text-xs truncate flex-1"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
        >
          {currentPath}
        </span>
        <button
          onClick={() => loadDir(currentPath)}
          className="w-7 h-7 flex items-center justify-center rounded-md btn-press shrink-0"
          style={{ color: "var(--text-tertiary)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 6a5 5 0 019.3-2.5M11 6a5 5 0 01-9.3 2.5" />
            <path d="M10.5 1v2.5H8M1.5 11V8.5H4" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="spinner" />
          </div>
        ) : (
          <>
            {/* Directories */}
            {dirs.map((d) => (
              <div
                key={d.path}
                className="flex items-center gap-2.5 px-3 py-2 border-b cursor-pointer"
                style={{ borderColor: "var(--border-subtle)" }}
                onClick={() => loadDir(d.path)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill={d.isGitRepo ? "var(--accent-cyan)" : "var(--accent-amber)"} className="shrink-0">
                  <path d="M1 2.5A1.5 1.5 0 012.5 1h2.672a1.5 1.5 0 011.06.44l.597.596a.5.5 0 00.354.147H11.5A1.5 1.5 0 0113 3.5V11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 11V2.5z" />
                </svg>
                <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{d.name}</span>
                {d.isGitRepo && (
                  <span className="text-[9px] px-1 rounded" style={{ background: "var(--accent-cyan-dim)", color: "var(--accent-cyan)" }}>git</span>
                )}
              </div>
            ))}

            {/* Files */}
            {files.map((f) => {
              const ext = f.split(".").pop()?.toLowerCase() || "";
              const isCode = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "css", "html", "json", "toml", "yaml", "yml", "md", "txt", "sh", "bat", "ps1"].includes(ext);
              return (
                <div
                  key={f}
                  className="flex items-center gap-2.5 px-3 py-2 border-b cursor-pointer"
                  style={{ borderColor: "var(--border-subtle)" }}
                  onClick={() => isCode ? viewFile(currentPath + "\\" + f) : undefined}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" className="shrink-0">
                    <path d="M8 1H3.5A1.5 1.5 0 002 2.5v9A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V5L8 1z" />
                    <path d="M8 1v4h4" />
                  </svg>
                  <span className="text-xs flex-1 truncate" style={{ color: isCode ? "var(--text-primary)" : "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{f}</span>
                  <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{ext}</span>
                </div>
              );
            })}

            {dirs.length === 0 && files.length === 0 && (
              <div className="py-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>空目录</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
