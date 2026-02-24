import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { buildFolderBreadcrumbs, folderDepthForNode, listUserFoldersTree } from "@/lib/workspace-tree";

type SortableNode = {
  pinnedAt: Date | null;
  sortIndex: number;
  updatedAt: Date;
};

function compareWorkspaceNodes<T extends SortableNode>(a: T, b: T) {
  const aPinned = Boolean(a.pinnedAt);
  const bPinned = Boolean(b.pinnedAt);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  if (a.pinnedAt && b.pinnedAt) {
    const pinnedDiff = b.pinnedAt.getTime() - a.pinnedAt.getTime();
    if (pinnedDiff !== 0) return pinnedDiff;
  }
  const sortDiff = a.sortIndex - b.sortIndex;
  if (sortDiff !== 0) return sortDiff;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const parentFolderParam = new URL(request.url).searchParams.get("parentFolderId");
  const parentFolderId = !parentFolderParam || parentFolderParam === "root" ? null : parentFolderParam;

  const folderTree = await listUserFoldersTree(user.id);
  let currentFolder: { id: string; title: string; parentFolderId: string | null; depth: number } | null = null;
  if (parentFolderId) {
    const folder = folderTree.find((node) => node.id === parentFolderId);
    if (!folder) {
      throw apiError(404, "Folder not found");
    }
    currentFolder = {
      id: folder.id,
      title: folder.title,
      parentFolderId: folder.parentFolderId,
      depth: folderDepthForNode(folderTree, folder.id)
    };
  }

  const [folders, projects] = await Promise.all([
    prisma.folder.findMany({
      where: { userId: user.id, parentFolderId },
      include: {
        _count: { select: { childFolders: true, projects: true } },
        childFolders: {
          select: { id: true, title: true, updatedAt: true, pinnedAt: true, sortIndex: true },
          take: 2
        },
        projects: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            pinnedAt: true,
            sortIndex: true,
            coverType: true,
            coverImageUrl: true,
            coverColorA: true,
            coverColorB: true
          },
          take: 2
        }
      }
    }),
    prisma.project.findMany({
      where: { userId: user.id, folderId: parentFolderId },
      include: { _count: { select: { tracks: true } } }
    })
  ]);

  const nodes = [
    ...folders.map((folder) => {
      const preview = [
        ...folder.childFolders.map((child) => ({
          id: child.id,
          type: "folder" as const,
          title: child.title,
          updatedAt: child.updatedAt,
          pinnedAt: child.pinnedAt,
          sortIndex: child.sortIndex
        })),
        ...folder.projects.map((project) => ({
          id: project.id,
          type: "project" as const,
          title: project.title,
          updatedAt: project.updatedAt,
          pinnedAt: project.pinnedAt,
          sortIndex: project.sortIndex,
          coverType: project.coverType,
          coverImageUrl: project.coverImageUrl,
          coverColorA: project.coverColorA,
          coverColorB: project.coverColorB
        }))
      ]
        .sort(compareWorkspaceNodes)
        .slice(0, 2)
        .map((item) =>
          item.type === "folder"
            ? { id: item.id, type: item.type, title: item.title }
            : {
                id: item.id,
                type: item.type,
                title: item.title,
                coverType: item.coverType,
                coverImageUrl: item.coverImageUrl,
                coverColorA: item.coverColorA,
                coverColorB: item.coverColorB
              }
        );

      return {
        id: folder.id,
        type: "folder" as const,
        title: folder.title,
        pinnedAt: folder.pinnedAt,
        updatedAt: folder.updatedAt,
        sortIndex: folder.sortIndex,
        itemCount: folder._count.childFolders + folder._count.projects,
        preview
      };
    }),
    ...projects.map((project) => ({
      id: project.id,
      type: "project" as const,
      title: project.title,
      pinnedAt: project.pinnedAt,
      updatedAt: project.updatedAt,
      sortIndex: project.sortIndex,
      projectMeta: {
        artistLabel: project.artistLabel,
        coverType: project.coverType,
        coverImageUrl: project.coverImageUrl,
        coverColorA: project.coverColorA,
        coverColorB: project.coverColorB,
        trackCount: project._count?.tracks ?? 0
      }
    }))
  ].sort(compareWorkspaceNodes);

  return NextResponse.json({
    currentFolder,
    breadcrumbs: buildFolderBreadcrumbs(folderTree, parentFolderId),
    nodes
  });
});
