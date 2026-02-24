"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { pickPreferredPlaybackDemo } from "@/lib/songs-playback-helpers";
import { useSongsPlayback, type SongsPlaybackItem } from "@/components/songs/songs-playback-provider";
import { DeleteFolderModal } from "@/components/songs/delete-folder-modal";
import { MoveNodeModal } from "@/components/songs/move-node-modal";
import { WorkspaceFolderTile } from "@/components/songs/workspace-folder-tile";
import { WorkspaceGrid } from "@/components/songs/workspace-grid";
import { WorkspaceProjectTile } from "@/components/songs/workspace-project-tile";
import type { FolderListItem, WorkspaceNode, WorkspaceNodesResponse, WorkspaceProjectNode } from "@/components/songs/workspace-types";

type WorkspaceBrowserProps = {
  parentFolderId: string | null;
  externalQuery?: string;
  showHeader?: boolean;
  showCreateActions?: boolean;
  className?: string;
  onChanged?: () => Promise<void> | void;
};

type FolderDeletePromptState = {
  id: string;
  title: string;
};

type ProjectDetailForPlayback = {
  id: string;
  title: string;
  coverType: "GRADIENT" | "IMAGE";
  coverImageUrl?: string | null;
  coverColorA?: string | null;
  coverColorB?: string | null;
  tracks: Array<{
    id: string;
    title: string;
    pathStage?: { id: number; name: string } | null;
    primaryDemo?: {
      id: string;
      audioUrl?: string | null;
      createdAt?: string;
      duration: number;
      versionType: "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED";
    } | null;
    demos: Array<{
      id: string;
      audioUrl?: string | null;
      createdAt?: string;
      duration: number;
      versionType: "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED";
    }>;
  }>;
};

function buildFoldersById(folders: FolderListItem[]) {
  return new Map(folders.map((folder) => [folder.id, folder]));
}

function getFolderDepthLocal(folders: FolderListItem[], folderId: string): number {
  const byId = buildFoldersById(folders);
  let depth = 0;
  let cursor: string | null = folderId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return 99;
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) return 99;
    depth += 1;
    cursor = node.parentFolderId;
  }
  return depth;
}

function isDescendantLocal(folders: FolderListItem[], folderId: string, maybeDescendantId: string) {
  const byId = buildFoldersById(folders);
  let cursor: string | null = maybeDescendantId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    if (cursor === folderId) return true;
    cursor = byId.get(cursor)?.parentFolderId ?? null;
  }
  return false;
}

function getFolderSubtreeDepthLocal(folders: FolderListItem[], folderId: string): number {
  const childrenByParent = new Map<string | null, FolderListItem[]>();
  for (const folder of folders) {
    const bucket = childrenByParent.get(folder.parentFolderId ?? null) ?? [];
    bucket.push(folder);
    childrenByParent.set(folder.parentFolderId ?? null, bucket);
  }
  function depthFrom(id: string): number {
    const children = childrenByParent.get(id) ?? [];
    if (!children.length) return 1;
    return 1 + Math.max(...children.map((child) => depthFrom(child.id)));
  }
  return depthFrom(folderId);
}

function defaultFolderDeleteError(responsePayload: { error?: string } | null) {
  return responsePayload?.error || "Не удалось удалить папку.";
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

export function WorkspaceBrowser({
  parentFolderId,
  externalQuery,
  showHeader = true,
  showCreateActions = true,
  className,
  onChanged
}: WorkspaceBrowserProps) {
  const playback = useSongsPlayback();
  const [localQuery, setLocalQuery] = useState("");
  const [error, setError] = useState("");
  const [menuKey, setMenuKey] = useState("");
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const [playLoadingProjectId, setPlayLoadingProjectId] = useState("");
  const [moveNode, setMoveNode] = useState<WorkspaceNode | null>(null);
  const [deleteFolderPrompt, setDeleteFolderPrompt] = useState<FolderDeletePromptState | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const query = externalQuery ?? localQuery;

  const {
    data: workspace,
    isLoading: workspaceLoading,
    refetch: refetchWorkspace
  } = useQuery({
    queryKey: ["workspace-nodes", parentFolderId ?? "root"],
    queryFn: () => fetcher<WorkspaceNodesResponse>(`/api/workspace/nodes?parentFolderId=${parentFolderId ?? "root"}`)
  });

  const { data: allFolders = [], refetch: refetchFolders } = useQuery({
    queryKey: ["workspace-all-folders"],
    queryFn: () => fetcher<FolderListItem[]>("/api/folders")
  });

  const nodes = workspace?.nodes ?? [];
  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((node) => node.title.toLowerCase().includes(needle));
  }, [nodes, query]);

  async function refreshAll() {
    await Promise.all([refetchWorkspace(), refetchFolders(), onChanged?.()]);
  }

  async function createFolder() {
    if (!newFolderTitle.trim()) return;
    setCreatingFolder(true);
    setError("");
    try {
      const response = await apiFetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newFolderTitle.trim(), parentFolderId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать папку.");
      }
      setNewFolderTitle("");
      setShowCreateFolder(false);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать папку.");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function createProject() {
    if (!newProjectTitle.trim()) return;
    setCreatingProject(true);
    setError("");
    try {
      const response = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          folderId: parentFolderId,
          coverType: "GRADIENT",
          coverPresetKey: "lime-grove",
          coverColorA: "#D9F99D",
          coverColorB: "#65A30D"
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать проект.");
      }
      setNewProjectTitle("");
      setShowCreateProject(false);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать проект.");
    } finally {
      setCreatingProject(false);
    }
  }

  async function patchFolder(folderId: string, payload: Record<string, unknown>) {
    const response = await apiFetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "Folder action failed");
    }
  }

  async function patchProject(projectId: string, payload: Record<string, unknown>) {
    const response = await apiFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "Project action failed");
    }
  }

  async function togglePin(node: WorkspaceNode) {
    const key = `${node.type}:${node.id}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      if (node.type === "folder") {
        await patchFolder(node.id, { pinned: !node.pinnedAt });
      } else {
        await patchProject(node.id, { pinned: !node.pinnedAt });
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить pin.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function renameProject(node: WorkspaceProjectNode) {
    const nextTitle = window.prompt("Новое название проекта", node.title)?.trim();
    if (!nextTitle || nextTitle === node.title) return;
    const key = `project:${node.id}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      await patchProject(node.id, { title: nextTitle });
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переименовать проект.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function deleteProject(node: WorkspaceProjectNode) {
    const confirmed = window.confirm(
      node.projectMeta.trackCount > 0 ? "Удалить проект вместе со всеми песнями и версиями?" : "Удалить пустой проект?"
    );
    if (!confirmed) return;
    const key = `project:${node.id}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      const response = await apiFetch(
        `/api/projects/${node.id}${node.projectMeta.trackCount > 0 ? "?force=1" : ""}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Не удалось удалить проект.");
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить проект.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function emptyFolder(folderId: string) {
    const key = `folder:${folderId}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      const response = await apiFetch(`/api/folders/${folderId}/empty`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Не удалось очистить папку.");
      }
      setDeleteFolderPrompt(null);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось очистить папку.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function deleteFolder(node: Extract<WorkspaceNode, { type: "folder" }>, mode?: "delete" | "delete_all") {
    const key = `folder:${node.id}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      const suffix = mode ? `?mode=${mode}` : "";
      const response = await apiFetch(`/api/folders/${node.id}${suffix}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; details?: { code?: string } }
          | null;
        if (payload?.details?.code === "FOLDER_NOT_EMPTY" && !mode) {
          setDeleteFolderPrompt({ id: node.id, title: node.title });
          return;
        }
        throw new Error(defaultFolderDeleteError(payload));
      }
      setDeleteFolderPrompt(null);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить папку.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function moveCurrentNode(targetFolderId: string | null) {
    if (!moveNode) return;
    const key = `${moveNode.type}:${moveNode.id}`;
    setActionLoadingKey(key);
    setError("");
    try {
      if (moveNode.type === "folder") {
        await patchFolder(moveNode.id, { parentFolderId: targetFolderId });
      } else {
        await patchProject(moveNode.id, { folderId: targetFolderId });
      }
      setMoveNode(null);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переместить элемент.");
    } finally {
      setActionLoadingKey("");
    }
  }

  function folderMoveDisabledReason(node: WorkspaceNode | null, targetFolderId: string | null): string | null {
    if (!node || node.type !== "folder") return null;
    if (targetFolderId === node.id) return "same";
    if (!targetFolderId) return null;
    if (isDescendantLocal(allFolders, node.id, targetFolderId)) return "descendant";
    const targetDepth = getFolderDepthLocal(allFolders, targetFolderId);
    const subtreeDepth = getFolderSubtreeDepthLocal(allFolders, node.id);
    if (targetDepth + subtreeDepth > 3) return "depth";
    return null;
  }

  async function groupNodes(source: WorkspaceNode, target: WorkspaceNode) {
    setError("");
    try {
      const response = await apiFetch("/api/workspace/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type: source.type, id: source.id },
          target: { type: target.type, id: target.id },
          currentParentFolderId: parentFolderId
        })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Не удалось сгруппировать элементы.");
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сгруппировать элементы.");
      throw e;
    }
  }

  function canGroup(source: WorkspaceNode, target: WorkspaceNode) {
    if (source.id === target.id && source.type === target.type) return false;
    if (source.type === "folder" && target.type === "project") return false;
    if (source.type === "folder" && target.type === "folder") {
      if (isDescendantLocal(allFolders, source.id, target.id)) return false;
      const targetDepth = getFolderDepthLocal(allFolders, target.id);
      const subtreeDepth = getFolderSubtreeDepthLocal(allFolders, source.id);
      if (targetDepth + subtreeDepth > 3) return false;
    }
    return true;
  }

  async function playProjectFromCard(projectId: string) {
    setPlayLoadingProjectId(projectId);
    setError("");
    try {
      const detail = await apiFetchJson<ProjectDetailForPlayback>(`/api/projects/${projectId}`);
      const coverType: "image" | "gradient" = detail.coverType === "IMAGE" ? "image" : "gradient";
      const queue: SongsPlaybackItem[] = [];
      for (const track of detail.tracks ?? []) {
        const preferredDemo = pickPreferredPlaybackDemo(track);
        if (!preferredDemo) continue;
        queue.push({
          demoId: preferredDemo.id,
          src: `/api/audio-clips/${preferredDemo.id}/stream`,
          title: track.title,
          subtitle: `${detail.title} • ${track.pathStage?.name ?? "Без статуса"}`,
          linkHref: `/songs/${track.id}`,
          durationSec: preferredDemo.duration,
          trackId: track.id,
          projectId: detail.id,
          versionType: preferredDemo.versionType,
          queueGroupType: "project",
          queueGroupId: detail.id,
          cover: {
            type: coverType,
            imageUrl: detail.coverImageUrl ?? null,
            colorA: detail.coverColorA ?? null,
            colorB: detail.coverColorB ?? null
          },
          meta: {
            projectTitle: detail.title,
            pathStageName: track.pathStage?.name ?? undefined
          }
        });
      }
      if (!queue.length) {
        setError("В проекте пока нет аудио-версий для воспроизведения.");
        return;
      }
      playback.playQueue(queue, 0, { type: "project", projectId: detail.id, title: detail.title });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить проект.");
    } finally {
      setPlayLoadingProjectId("");
    }
  }

  const folderToDelete = deleteFolderPrompt
    ? (filteredNodes.find((node) => node.type === "folder" && node.id === deleteFolderPrompt.id) ??
      workspace?.nodes.find((node) => node.type === "folder" && node.id === deleteFolderPrompt.id) ??
      null)
    : null;

  return (
    <Card className={className ?? "overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-[#f4f8ee] via-[#eff4e8] to-[#e8efde] p-0 shadow-sm"}>
      {showHeader && (
        <div className="border-b border-brand-border px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-brand-ink">
                {workspace?.currentFolder?.title ?? "Projects&Folders"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                {(workspace?.breadcrumbs ?? []).map((crumb, index) => (
                  <span key={`${crumb.id ?? "root"}-${index}`} className="inline-flex items-center gap-2">
                    {crumb.id ? <Link href={`/songs/folders/${crumb.id}`} className="hover:underline">{crumb.title}</Link> : <Link href="/songs" className="hover:underline">{crumb.title}</Link>}
                    {index < (workspace?.breadcrumbs.length ?? 0) - 1 && <span>/</span>}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showCreateActions && (
                <>
                  <Button variant="secondary" onClick={() => setShowCreateFolder((prev) => !prev)}>
                    + Folder
                  </Button>
                  <Button variant="secondary" onClick={() => setShowCreateProject((prev) => !prev)}>
                    + Project
                  </Button>
                </>
              )}
            </div>
          </div>

          {externalQuery === undefined && (
            <div className="mt-3">
              <Input value={localQuery} onChange={(event) => setLocalQuery(event.target.value)} placeholder="Поиск по текущему уровню..." className="bg-white/90" />
            </div>
          )}

          {(showCreateFolder || showCreateProject) && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {showCreateFolder && (
                <div className="rounded-2xl border border-brand-border bg-white/90 p-3">
                  <p className="mb-2 text-sm font-medium text-brand-ink">Новая папка</p>
                  <div className="flex gap-2">
                    <Input value={newFolderTitle} onChange={(event) => setNewFolderTitle(event.target.value)} placeholder="untitled folder" />
                    <Button onClick={createFolder} disabled={creatingFolder || !newFolderTitle.trim()}>
                      {creatingFolder ? "..." : "Create"}
                    </Button>
                  </div>
                </div>
              )}
              {showCreateProject && (
                <div className="rounded-2xl border border-brand-border bg-white/90 p-3">
                  <p className="mb-2 text-sm font-medium text-brand-ink">Новый проект</p>
                  <div className="flex gap-2">
                    <Input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="untitled project" />
                    <Button onClick={createProject} disabled={creatingProject || !newProjectTitle.trim()}>
                      {creatingProject ? "..." : "Create"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>
      )}

      {!showHeader && error && <div className="p-4 pb-0"><p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p></div>}

      <div className="p-4">
        {workspaceLoading ? (
          <div className="rounded-2xl border border-brand-border bg-white/70 p-4 text-sm text-brand-muted">Загрузка workspace...</div>
        ) : (
          <>
            <WorkspaceGrid
              nodes={filteredNodes}
              enableGrouping
              canGroup={canGroup}
              onGroup={groupNodes}
              renderNode={({ node, dragState, bindDrag }) => {
                const key = `${node.type}:${node.id}`;
                const menuOpen = menuKey === key;
                const menu = (
                  <div className="absolute right-0 top-10 z-10 min-w-[200px] rounded-2xl border border-brand-border bg-[#f7fbf2] p-2 shadow-[0_20px_40px_rgba(45,60,40,0.16)]">
                    {node.type === "folder" ? (
                      <>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5" onClick={() => togglePin(node)}>
                          {node.pinnedAt ? "Unpin folder" : "Pin folder"}
                        </button>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5" onClick={() => { setMoveNode(node); setMenuKey(""); }}>
                          Move folder
                        </button>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5" onClick={() => void emptyFolder(node.id)}>
                          Empty folder
                        </button>
                        <div className="my-1 h-px bg-black/5" />
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-black/5" onClick={() => void deleteFolder(node)}>
                          Delete folder
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={`/songs/projects/${node.id}`} className="block rounded-xl px-3 py-2 text-sm text-brand-ink hover:bg-black/5" onClick={() => setMenuKey("")}>
                          Open
                        </Link>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5" onClick={() => togglePin(node)}>
                          {node.pinnedAt ? "Unpin project" : "Pin project"}
                        </button>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5" onClick={() => { setMoveNode(node); setMenuKey(""); }}>
                          Move project
                        </button>
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5" onClick={() => void renameProject(node)}>
                          Rename project
                        </button>
                        <div className="my-1 h-px bg-black/5" />
                        <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-black/5" onClick={() => void deleteProject(node)}>
                          Delete project
                        </button>
                      </>
                    )}
                  </div>
                );

                if (node.type === "folder") {
                  return (
                    <WorkspaceFolderTile
                      key={key}
                      node={node}
                      menuOpen={menuOpen}
                      onToggleMenu={() => setMenuKey((prev) => (prev === key ? "" : key))}
                      menuContent={menu}
                      dragState={dragState}
                      tileProps={bindDrag}
                    />
                  );
                }

                return (
                  <WorkspaceProjectTile
                    key={key}
                    node={node}
                    menuOpen={menuOpen}
                    onToggleMenu={() => setMenuKey((prev) => (prev === key ? "" : key))}
                    menuContent={menu}
                    dragState={dragState}
                    tileProps={bindDrag}
                    onPlay={() => void playProjectFromCard(node.id)}
                    playLoading={playLoadingProjectId === node.id}
                  />
                );
              }}
            />

            {!filteredNodes.length && (
              <div className="mt-4 rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
                В этом уровне пока пусто.
              </div>
            )}
          </>
        )}
      </div>

      <MoveNodeModal
        open={Boolean(moveNode)}
        node={moveNode}
        folders={allFolders}
        loading={Boolean(actionLoadingKey)}
        onClose={() => setMoveNode(null)}
        onMove={(targetFolderId) => void moveCurrentNode(targetFolderId)}
        getTargetDisabledReason={(targetFolderId) => {
          if (!moveNode) return null;
          if (moveNode.type === "project") return null;
          return folderMoveDisabledReason(moveNode, targetFolderId);
        }}
      />

      <DeleteFolderModal
        open={Boolean(deleteFolderPrompt)}
        folderTitle={deleteFolderPrompt?.title ?? ""}
        busy={Boolean(actionLoadingKey)}
        onCancel={() => setDeleteFolderPrompt(null)}
        onEmptyFolder={() => deleteFolderPrompt && void emptyFolder(deleteFolderPrompt.id)}
        onDeleteEverything={() => {
          if (!deleteFolderPrompt) return;
          const node = (folderToDelete as Extract<WorkspaceNode, { type: "folder" }> | null) ?? {
            id: deleteFolderPrompt.id,
            title: deleteFolderPrompt.title,
            type: "folder",
            pinnedAt: null,
            updatedAt: new Date().toISOString(),
            sortIndex: 0,
            itemCount: 0,
            preview: []
          };
          void deleteFolder(node, "delete_all");
        }}
      />
    </Card>
  );
}
