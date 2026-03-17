import { useState } from "react";
import { setToken } from "../lib/api";

interface Props {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [token, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/status", {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });

      if (res.ok) {
        setToken(token.trim());
        onLogin();
      } else if (res.status === 401 || res.status === 403) {
        setError("令牌无效");
      } else {
        setError(`服务器错误: ${res.status}`);
      }
    } catch {
      setError("无法连接服务器");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center h-full p-6"
      style={{ background: "var(--bg-root)" }}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 page-enter">
        <div className="text-center">
          <div className="relative inline-block mb-1">
            <div
              className="logo-breathe absolute inset-[-20px] blur-3xl rounded-full"
              style={{ background: "var(--accent-cyan)", opacity: 0.12 }}
            />
            <h1
              className="relative text-4xl font-bold tracking-tight"
              style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}
            >
              ClawPhone
            </h1>
          </div>
          <p className="text-sm mt-3" style={{ color: "var(--text-tertiary)" }}>
            输入网关令牌以连接
          </p>
        </div>

        <input
          type="password"
          placeholder="网关令牌"
          value={token}
          onChange={(e) => setTokenInput(e.target.value)}
          autoFocus
          className="w-full px-4 py-3.5 rounded-xl text-sm border outline-none transition-colors"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            borderColor: "var(--border-default)",
            fontFamily: "var(--font-mono)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-cyan)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
        />

        {error && (
          <p className="text-xs text-center" style={{ color: "var(--accent-red)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="w-full py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 btn-glow btn-press"
          style={{
            background: "var(--accent-cyan)",
            color: "var(--text-inverse)",
          }}
        >
          {loading ? "连接中..." : "连接"}
        </button>
      </form>
    </div>
  );
}
