import { Eye, EyeOff, MoveDown, MoveUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { artistWorldBlockIds, type ArtistWorldBlockId } from "@/lib/artist-growth";

const blockLabels: Record<ArtistWorldBlockId, string> = {
  mission: "Mission",
  identity: "Identity",
  themes_audience: "Themes & Audience",
  aesthetics: "Aesthetics",
  fashion: "Fashion",
  playlist: "Playlist"
};

export function ArtistWorldBlockManager(props: {
  blockOrder: ArtistWorldBlockId[];
  hiddenBlocks: ArtistWorldBlockId[];
  onMoveUp: (blockId: ArtistWorldBlockId) => void;
  onMoveDown: (blockId: ArtistWorldBlockId) => void;
  onToggleVisibility: (blockId: ArtistWorldBlockId) => void;
}) {
  return (
    <div className="space-y-2">
      {props.blockOrder.map((blockId, index) => {
        const isHidden = props.hiddenBlocks.includes(blockId);

        return (
          <div key={blockId} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-border bg-white/80 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-ink">{blockLabels[blockId]}</p>
              <p className="text-xs text-brand-muted">
                {isHidden ? "Скрыт в превью" : "Показан в превью"} • {index + 1} / {artistWorldBlockIds.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-8 rounded-lg px-2" type="button" onClick={() => props.onToggleVisibility(blockId)}>
                {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" className="h-8 rounded-lg px-2" type="button" onClick={() => props.onMoveUp(blockId)} disabled={index === 0}>
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="h-8 rounded-lg px-2"
                type="button"
                onClick={() => props.onMoveDown(blockId)}
                disabled={index === props.blockOrder.length - 1}
              >
                <MoveDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
