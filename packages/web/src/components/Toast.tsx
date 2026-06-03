import { useEffect } from "react";

/**
 * A small, unobtrusive notification that auto-dismisses. Used for low-stakes
 * "this just happened" messages (e.g. the bundle auto-loaded from cache).
 */
export function Toast({
  message,
  onDismiss,
  durationMs = 6000,
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-emerald-700/50 bg-zinc-900/95 px-3.5 py-2.5 text-xs text-zinc-200 shadow-lg shadow-black/30 backdrop-blur"
    >
      <div className="flex items-start gap-2">
        <span className="mt-px text-emerald-400">✓</span>
        <span className="flex-1 leading-relaxed">{message}</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded px-1 text-zinc-500 hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
