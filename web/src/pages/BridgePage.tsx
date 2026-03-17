export function BridgePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-neutral-600 p-6">
      <span className="text-4xl font-mono font-bold text-neutral-700 mb-4">B</span>
      <h2 className="text-lg font-bold text-neutral-400 mb-2">App Bridge</h2>
      <p className="text-sm text-center leading-relaxed max-w-xs">
        Remote control for Codex App desktop window. Coming in Phase 2.
      </p>
      <div className="mt-6 px-4 py-2 rounded-lg border border-neutral-800 text-xs text-neutral-500">
        Requires: clawphone-bridge.ps1 running on Windows
      </div>
    </div>
  );
}
