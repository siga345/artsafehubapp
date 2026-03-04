"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Disc3, FolderOpen, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { projectDefaultCoverForKind } from "@/lib/project-cover-style";
import { pickPreferredPlaybackDemo } from "@/lib/songs-playback-helpers";
import { getProjectOpenHref, type ProjectReleaseKind } from "@/lib/songs-project-navigation";
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

type ProjectRenamePromptState = {
  id: string;
  initialTitle: string;
  value: string;
};

type ProjectDeletePromptState = {
  id: string;
  title: string;
  trackCount: number;
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

function getWorkspaceHref(folderId: string | null) {
  return folderId ? `/songs/folders/${folderId}` : "/songs";
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
  const [deleteEmptyFolderPrompt, setDeleteEmptyFolderPrompt] = useState<FolderDeletePromptState | null>(null);
  const [renameProjectPrompt, setRenameProjectPrompt] = useState<ProjectRenamePromptState | null>(null);
  const [deleteProjectPrompt, setDeleteProjectPrompt] = useState<ProjectDeletePromptState | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectReleaseKind, setNewProjectReleaseKind] = useState<ProjectReleaseKind>("ALBUM");
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

  const nodes = useMemo(() => workspace?.nodes ?? [], [workspace?.nodes]);
  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((node) => node.title.toLowerCase().includes(needle));
  }, [nodes, query]);
  const levelFolderCount = nodes.filter((node) => node.type === "folder").length;
  const levelProjectCount = nodes.filter((node) => node.type === "project").length;
  const visibleFolderCount = filteredNodes.filter((node) => node.type === "folder").length;
  const visibleProjectCount = filteredNodes.filter((node) => node.type === "project").length;

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
      const defaults = projectDefaultCoverForKind(newProjectReleaseKind);
      const response = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          folderId: parentFolderId,
          releaseKind: newProjectReleaseKind,
          coverType: "GRADIENT",
          coverPresetKey: defaults.coverPresetKey,
          coverColorA: defaults.coverColorA,
          coverColorB: defaults.coverColorB
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать проект.");
      }
      setNewProjectTitle("");
      setShowCreateProject(false);
      setNewProjectReleaseKind("ALBUM");
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
      throw new Error(body?.error || "Не удалось выполнить действие с папкой.");
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

  async function renameProject(projectId: string, nextTitle: string) {
    const key = `project:${projectId}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      await patchProject(projectId, { title: nextTitle });
      setRenameProjectPrompt(null);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переименовать проект.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function deleteProject(projectId: string, trackCount: number) {
    const key = `project:${projectId}`;
    setActionLoadingKey(key);
    setError("");
    setMenuKey("");
    try {
      const response = await apiFetch(
        `/api/projects/${projectId}${trackCount > 0 ? "?force=1" : ""}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Не удалось удалить проект.");
      }
      setDeleteProjectPrompt(null);
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
      setDeleteEmptyFolderPrompt(null);
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
      setDeleteEmptyFolderPrompt(null);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить папку.");
    } finally {
      setActionLoadingKey("");
    }
  }

  function requestDeleteFolder(node: Extract<WorkspaceNode, { type: "folder" }>) {
    setError("");
    setMenuKey("");
    if (node.itemCount > 0) {
      setDeleteFolderPrompt({ id: node.id, title: node.title });
      return;
    }
    setDeleteEmptyFolderPrompt({ id: node.id, title: node.title });
  }

  function requestProjectRename(node: WorkspaceProjectNode) {
    setError("");
    setMenuKey("");
    setRenameProjectPrompt({ id: node.id, initialTitle: node.title, value: node.title });
  }

  function requestProjectDelete(node: WorkspaceProjectNode) {
    setError("");
    setMenuKey("");
    setDeleteProjectPrompt({
      id: node.id,
      title: node.title,
      trackCount: node.projectMeta.trackCount
    });
  }

  function submitProjectRename() {
    if (!renameProjectPrompt) return;
    const nextTitle = renameProjectPrompt.value.trim();
    if (!nextTitle || nextTitle === renameProjectPrompt.initialTitle) {
      setRenameProjectPrompt(null);
      return;
    }
    void renameProject(renameProjectPrompt.id, nextTitle);
  }

  function submitProjectDelete() {
    if (!deleteProjectPrompt) return;
    void deleteProject(deleteProjectPrompt.id, deleteProjectPrompt.trackCount);
  }

  function submitEmptyFolderDelete() {
    if (!deleteEmptyFolderPrompt) return;
    const fallbackNode: Extract<WorkspaceNode, { type: "folder" }> = {
      id: deleteEmptyFolderPrompt.id,
      title: deleteEmptyFolderPrompt.title,
      type: "folder",
      pinnedAt: null,
      updatedAt: new Date().toISOString(),
      sortIndex: 0,
      itemCount: 0,
      preview: []
    };
    setDeleteEmptyFolderPrompt(null);
    void deleteFolder(fallbackNode, "delete");
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

  function openCreateProject(kind: ProjectReleaseKind) {
    setNewProjectReleaseKind(kind);
    setShowCreateProject((prev) => (prev && newProjectReleaseKind === kind ? false : true));
  }

  return (
    <Card
      className={
        className ??
        "relative overflow-hidden rounded-[22px] border border-brand-border bg-gradient-to-br from-[#f4f8ee] via-[#eff4e8] to-[#e8efde] p-0 shadow-[0_18px_46px_rgba(55,74,61,0.14)] md:rounded-3xl"
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(217,249,157,0.25),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.06),transparent_42%)]" />
      {showHeader && (
        <div className="relative border-b border-brand-border px-3 py-3 md:px-5 md:py-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.45),transparent_38%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-white px-2 py-0.5 text-[11px] md:px-2.5 md:py-1 md:text-xs">
                  <span className="-rotate-6 mr-1 inline-flex h-4 w-4 items-center justify-center rounded-md border border-brand-border bg-white shadow-[0_1px_0_rgba(42,52,44,0.08)] md:h-5 md:w-5">
                    <Disc3 className="h-3 w-3 text-brand-ink" />
                  </span>
                  Рабочая зона
                </Badge>
              </div>
              {workspace?.breadcrumbs?.length ? (
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-brand-muted">
                  {workspace.currentFolder && (
                    <Link
                      href={getWorkspaceHref(workspace.currentFolder.parentFolderId ?? null)}
                      className="rounded-lg border border-brand-border bg-white/80 px-2 py-0.5 text-xs text-brand-ink hover:bg-white md:px-2 md:py-1 md:text-sm"
                    >
                      ← Назад
                    </Link>
                  )}
                  <nav aria-label="Путь папок" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {workspace.breadcrumbs.map((crumb, index) => {
                      const isLast = index === workspace.breadcrumbs.length - 1;
                      return (
                        <span key={`${crumb.id ?? "root"}:${index}`} className="inline-flex min-w-0 items-center gap-2">
                          {isLast ? (
                            <span className="max-w-[220px] truncate text-xs text-brand-ink md:max-w-[240px] md:text-sm">{crumb.title}</span>
                          ) : (
                            <Link
                              href={getWorkspaceHref(crumb.id)}
                              className="max-w-[160px] truncate text-xs hover:text-brand-ink hover:underline md:max-w-[180px] md:text-sm"
                            >
                              {crumb.title}
                            </Link>
                          )}
                          {!isLast && <span aria-hidden>›</span>}
                        </span>
                      );
                    })}
                  </nav>
                </div>
              ) : null}
              <h2 className="text-lg font-semibold tracking-tight text-brand-ink md:text-xl">
                {workspace?.currentFolder?.title ?? "Проекты и папки"}
              </h2>
              <p className="mt-1 text-xs text-brand-muted md:text-sm">
                {levelFolderCount} папок • {levelProjectCount} проектов на текущем уровне
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showCreateActions && (
                <>
                  <Button
                    variant="secondary"
                    className="h-9 rounded-xl border-brand-border bg-white/85 px-3 text-sm text-brand-ink hover:bg-white md:h-10"
                    onClick={() => setShowCreateFolder((prev) => !prev)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    + Папка
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 rounded-xl border-brand-border bg-white/85 px-3 text-sm text-brand-ink hover:bg-white md:h-10"
                    onClick={() => openCreateProject("SINGLE")}
                  >
                    <Disc3 className="h-4 w-4" />
                    + Сингл
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 rounded-xl border-brand-border bg-white/85 px-3 text-sm text-brand-ink hover:bg-white md:h-10"
                    onClick={() => openCreateProject("ALBUM")}
                  >
                    <Disc3 className="h-4 w-4" />
                    + Альбом
                  </Button>
                </>
              )}
            </div>
          </div>

          {externalQuery === undefined && (
            <div className="mt-3 rounded-2xl border border-brand-border bg-white/65 p-3 shadow-sm backdrop-blur-sm">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  value={localQuery}
                  onChange={(event) => setLocalQuery(event.target.value)}
                  placeholder="Поиск по текущему уровню..."
                  className="h-10 bg-white pl-9 md:h-11"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] text-brand-muted md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                  Видно папок: <span className="ml-1 font-medium text-brand-ink">{visibleFolderCount}</span>
                </span>
                <span className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] text-brand-muted md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                  Видно проектов: <span className="ml-1 font-medium text-brand-ink">{visibleProjectCount}</span>
                </span>
              </div>
            </div>
          )}

          {(showCreateFolder || showCreateProject) && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {showCreateFolder && (
                <div className="relative overflow-hidden rounded-xl border border-brand-border bg-white/90 p-2.5 shadow-sm md:rounded-2xl md:p-3">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d9f99d] to-transparent" />
                  <p className="mb-2 text-xs font-medium text-brand-ink md:text-sm">Новая папка</p>
                  <div className="flex gap-2">
                    <Input
                      value={newFolderTitle}
                      onChange={(event) => setNewFolderTitle(event.target.value)}
                      placeholder="Название папки"
                      className="bg-white"
                    />
                    <Button className="h-10 rounded-xl px-3 text-sm" onClick={createFolder} disabled={creatingFolder || !newFolderTitle.trim()}>
                      {creatingFolder ? "..." : "Создать"}
                    </Button>
                  </div>
                </div>
              )}
              {showCreateProject && (
                <div className="relative overflow-hidden rounded-xl border border-brand-border bg-white/90 p-2.5 shadow-sm md:rounded-2xl md:p-3">
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${newProjectReleaseKind === "SINGLE" ? "from-[#bfdbfe] to-transparent" : "from-[#fda4af] via-[#c4b5fd] to-transparent"}`} />
                  <p className="mb-1 text-xs font-medium text-brand-ink md:text-sm">
                    Новый {newProjectReleaseKind === "SINGLE" ? "сингл" : "альбом"}
                  </p>
                  <p className="mb-2 text-[11px] text-brand-muted md:text-xs">
                    {newProjectReleaseKind === "SINGLE"
                      ? "Сингл открывается сразу в версии, когда внутри появится 1 трек."
                      : "Альбом сохраняет текущую страницу проекта и плейлист треков."}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={newProjectTitle}
                      onChange={(event) => setNewProjectTitle(event.target.value)}
                      placeholder={newProjectReleaseKind === "SINGLE" ? "Название сингла" : "Название альбома"}
                      className="bg-white"
                    />
                    <Button className="h-10 rounded-xl px-3 text-sm" onClick={createProject} disabled={creatingProject || !newProjectTitle.trim()}>
                      {creatingProject ? "..." : "Создать"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>
      )}

      {!showHeader && error && <div className="p-3 pb-0 md:p-4 md:pb-0"><p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p></div>}

      <div className="relative p-3 md:p-5">
        {workspaceLoading ? (
          <div className="rounded-2xl border border-brand-border bg-white/70 p-4 text-sm text-brand-muted shadow-sm">Загрузка workspace...</div>
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
                  <div
                    className="absolute right-0 top-10 z-10 min-w-[200px] rounded-2xl border border-brand-border bg-[#f7fbf2] p-2 shadow-[0_20px_40px_rgba(45,60,40,0.16)]"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {node.type === "folder" ? (
                      <>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void togglePin(node);
                          }}
                        >
                          {node.pinnedAt ? "Открепить папку" : "Закрепить папку"}
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMoveNode(node);
                            setMenuKey("");
                          }}
                        >
                          Переместить папку
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void emptyFolder(node.id);
                          }}
                        >
                          Очистить папку
                        </button>
                        <div className="my-1 h-px bg-black/5" />
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            requestDeleteFolder(node);
                          }}
                        >
                          Удалить папку
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={getProjectOpenHref({
                            id: node.id,
                            releaseKind: node.projectMeta.releaseKind ?? "ALBUM",
                            singleTrackId: node.projectMeta.singleTrackId ?? null
                          })}
                          className="block rounded-xl px-3 py-2 text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuKey("");
                          }}
                        >
                          Открыть
                        </Link>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void togglePin(node);
                          }}
                        >
                          {node.pinnedAt ? "Открепить проект" : "Закрепить проект"}
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setMoveNode(node);
                            setMenuKey("");
                          }}
                        >
                          Переместить проект
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            requestProjectRename(node);
                          }}
                        >
                          Переименовать проект
                        </button>
                        <div className="my-1 h-px bg-black/5" />
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-black/5"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            requestProjectDelete(node);
                          }}
                        >
                          Удалить проект
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
              <div className="mt-4 rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted shadow-sm">
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

      {deleteEmptyFolderPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-3 pt-16 backdrop-blur-sm md:items-center md:p-6"
          onClick={() => {
            if (actionLoadingKey) return;
            setDeleteEmptyFolderPrompt(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_20px_60px_rgba(24,32,27,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-brand-ink">Удалить папку?</h3>
            <p className="mt-2 text-sm text-brand-muted">
              Папка <span className="font-medium text-brand-ink">«{deleteEmptyFolderPrompt.title}»</span> пустая. Подтверди удаление.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeleteEmptyFolderPrompt(null)}
                disabled={Boolean(actionLoadingKey)}
              >
                Отмена
              </Button>
              <Button onClick={submitEmptyFolderDelete} disabled={Boolean(actionLoadingKey)}>
                {actionLoadingKey === `folder:${deleteEmptyFolderPrompt.id}` ? "Удаляем..." : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {renameProjectPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-3 pt-16 backdrop-blur-sm md:items-center md:p-6"
          onClick={() => {
            if (actionLoadingKey) return;
            setRenameProjectPrompt(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_20px_60px_rgba(24,32,27,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-brand-ink">Переименовать проект</h3>
            <p className="mt-2 text-sm text-brand-muted">Новое название проекта:</p>
            <Input
              value={renameProjectPrompt.value}
              onChange={(event) =>
                setRenameProjectPrompt((prev) => (prev ? { ...prev, value: event.target.value } : prev))
              }
              className="mt-3 bg-white"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRenameProjectPrompt(null)} disabled={Boolean(actionLoadingKey)}>
                Отмена
              </Button>
              <Button
                onClick={submitProjectRename}
                disabled={Boolean(actionLoadingKey) || !renameProjectPrompt.value.trim()}
              >
                {actionLoadingKey === `project:${renameProjectPrompt.id}` ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteProjectPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-3 pt-16 backdrop-blur-sm md:items-center md:p-6"
          onClick={() => {
            if (actionLoadingKey) return;
            setDeleteProjectPrompt(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_20px_60px_rgba(24,32,27,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-brand-ink">Удалить проект?</h3>
            <p className="mt-2 text-sm text-brand-muted">
              {deleteProjectPrompt.trackCount > 0
                ? `Проект «${deleteProjectPrompt.title}» будет удален вместе со всеми песнями и версиями.`
                : `Проект «${deleteProjectPrompt.title}» пустой и будет удален.`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteProjectPrompt(null)} disabled={Boolean(actionLoadingKey)}>
                Отмена
              </Button>
              <Button onClick={submitProjectDelete} disabled={Boolean(actionLoadingKey)}>
                {actionLoadingKey === `project:${deleteProjectPrompt.id}` ? "Удаляем..." : "Удалить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
