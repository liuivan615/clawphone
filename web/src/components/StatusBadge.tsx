interface Props {
  label: string;
  online: boolean;
  detail?: string;
}

export function StatusBadge({ label, online, detail }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 rounded-xl">
      <div className="flex items-center gap-3">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            online ? "bg-emerald-400" : "bg-red-400"
          }`}
        />
        <span className="text-sm text-neutral-200 font-medium">{label}</span>
      </div>
      <span className="text-xs text-neutral-500">
        {detail || (online ? "Online" : "Offline")}
      </span>
    </div>
  );
}
