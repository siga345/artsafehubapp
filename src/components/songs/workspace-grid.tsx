"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import type { WorkspaceNode } from "@/components/songs/workspace-types";

type DragState = "idle" | "dragging" | "drop-target" | "drop-invalid";

type WorkspaceGridProps = {
  nodes: WorkspaceNode[];
  renderNode: (args: {
    node: WorkspaceNode;
    dragState: DragState;
    bindDrag: {
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
      onPointerEnter: () => void;
      onPointerLeave: () => void;
      onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
    };
  }) => ReactNode;
  enableGrouping?: boolean;
  canGroup?: (source: WorkspaceNode, target: WorkspaceNode) => boolean;
  onGroup?: (source: WorkspaceNode, target: WorkspaceNode) => Promise<void> | void;
};

type ActiveDrag = {
  source: WorkspaceNode;
  pointerId: number;
};

const LONG_PRESS_MS = 300;
const MOVE_CANCEL_PX = 8;

export function WorkspaceGrid({
  nodes,
  renderNode,
  enableGrouping,
  canGroup,
  onGroup
}: WorkspaceGridProps) {
  const byId = useMemo(() => new Map(nodes.map((node) => [`${node.type}:${node.id}`, node])), [nodes]);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [suppressClickUntil, setSuppressClickUntil] = useState(0);

  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ node: WorkspaceNode; pointerId: number; x: number; y: number } | null>(null);
  const activeRef = useRef<ActiveDrag | null>(null);
  const dropTargetRef = useRef<string | null>(null);

  useEffect(() => {
    activeRef.current = activeDrag;
  }, [activeDrag]);
  useEffect(() => {
    dropTargetRef.current = dropTargetKey;
  }, [dropTargetKey]);

  useEffect(() => {
    function clearPending() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
    }

    async function onPointerUp() {
      clearPending();
      const currentDrag = activeRef.current;
      const currentDropTargetKey = dropTargetRef.current;
      if (currentDrag && currentDropTargetKey && onGroup) {
        const target = byId.get(currentDropTargetKey);
        if (target && target.id !== currentDrag.source.id) {
          const allowed = canGroup ? canGroup(currentDrag.source, target) : true;
          if (allowed) {
            try {
              await onGroup(currentDrag.source, target);
            } catch {
              // action error handled by container
            }
          }
        }
      }
      if (currentDrag) {
        setSuppressClickUntil(Date.now() + 300);
      }
      setActiveDrag(null);
      setDropTargetKey(null);
      setPointer(null);
    }

    function onPointerMove(event: PointerEvent) {
      if (pendingRef.current) {
        const dx = event.clientX - pendingRef.current.x;
        const dy = event.clientY - pendingRef.current.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          clearPending();
        }
      }
      if (activeRef.current) {
        setPointer({ x: event.clientX, y: event.clientY });
      }
    }

    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      clearPending();
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [byId, canGroup, onGroup]);

  function startLongPress(node: WorkspaceNode, event: ReactPointerEvent<HTMLDivElement>) {
    if (!enableGrouping) return;
    if (event.button !== 0 && event.pointerType !== "touch") return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;

    pendingRef.current = {
      node,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    timerRef.current = window.setTimeout(() => {
      if (!pendingRef.current) return;
      setActiveDrag({
        source: pendingRef.current.node,
        pointerId: pendingRef.current.pointerId
      });
      setPointer({ x: pendingRef.current.x, y: pendingRef.current.y });
      pendingRef.current = null;
      timerRef.current = null;
      setSuppressClickUntil(Date.now() + 300);
    }, LONG_PRESS_MS);
  }

  function dragStateFor(node: WorkspaceNode): DragState {
    if (!activeDrag) return "idle";
    if (activeDrag.source.id === node.id && activeDrag.source.type === node.type) return "dragging";
    const key = `${node.type}:${node.id}`;
    if (dropTargetKey !== key) return "idle";
    const allowed = canGroup ? canGroup(activeDrag.source, node) : true;
    return allowed ? "drop-target" : "drop-invalid";
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {nodes.map((node) =>
          renderNode({
            node,
            dragState: dragStateFor(node),
            bindDrag: {
              onPointerDown: (event) => startLongPress(node, event),
              onPointerEnter: () => {
                if (!activeRef.current) return;
                if (activeRef.current.source.id === node.id && activeRef.current.source.type === node.type) return;
                setDropTargetKey(`${node.type}:${node.id}`);
              },
              onPointerLeave: () => {
                if (dropTargetRef.current === `${node.type}:${node.id}`) {
                  setDropTargetKey(null);
                }
              },
              onClickCapture: (event) => {
                if (Date.now() < suppressClickUntil) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }
            }
          })
        )}
      </div>

      {activeDrag && pointer && (
        <div
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand-border bg-white/95 px-3 py-2 text-sm font-medium text-brand-ink shadow-2xl"
          style={{ left: pointer.x, top: pointer.y }}
        >
          {activeDrag.source.type === "folder" ? "Folder" : "Project"}: {activeDrag.source.title}
        </div>
      )}
    </>
  );
}
