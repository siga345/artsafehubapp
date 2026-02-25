type SongAnalysisBadgesProps = {
  bpm?: number | null;
  keyRoot?: string | null;
  keyMode?: string | null;
  className?: string;
  compact?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatBpmLabel(bpm: number | null | undefined) {
  if (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm <= 0) return null;
  return `${Math.round(bpm)} BPM`;
}

function formatKeyLabel(keyRoot: string | null | undefined, keyMode: string | null | undefined) {
  if (!keyRoot) return null;
  if (keyMode === "minor") return `${keyRoot} Min`;
  if (keyMode === "major") return `${keyRoot} Maj`;
  return keyRoot;
}

export function SongAnalysisBadges({ bpm, keyRoot, keyMode, className, compact = false }: SongAnalysisBadgesProps) {
  const bpmLabel = formatBpmLabel(bpm);
  const keyLabel = formatKeyLabel(keyRoot, keyMode);

  if (!bpmLabel && !keyLabel) return null;

  return (
    <div className={cx("flex flex-wrap items-center gap-1.5", className)}>
      {keyLabel ? (
        <span
          className={cx(
            "inline-flex items-center rounded-full border border-[#d6ddcb] bg-[#f4f8ee] font-mono text-[#2d372d]",
            compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
          )}
        >
          {keyLabel}
        </span>
      ) : null}
      {bpmLabel ? (
        <span
          className={cx(
            "inline-flex items-center rounded-full border border-[#d8deea] bg-[#eef2f8] font-mono text-[#3b465a]",
            compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
          )}
        >
          {bpmLabel}
        </span>
      ) : null}
    </div>
  );
}

