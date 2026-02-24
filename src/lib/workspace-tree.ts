import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const MAX_FOLDER_DEPTH = 3;

export type FolderTreeNode = {
  id: string;
  title: string;
  parentFolderId: string | null;
};

export async function listUserFoldersTree(userId: string): Promise<FolderTreeNode[]> {
  return prisma.folder.findMany({
    where: { userId },
    select: { id: true, title: true, parentFolderId: true }
  });
}

function byIdMap(nodes: FolderTreeNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function getFolderDepthFromNodes(nodes: FolderTreeNode[], folderId: string): number {
  const byId = byIdMap(nodes);
  let depth = 0;
  let currentId: string | null = folderId;
  const seen = new Set<string>();

  while (currentId) {
    if (seen.has(currentId)) {
      throw apiError(400, "Folder tree cycle detected");
    }
    seen.add(currentId);

    const node = byId.get(currentId);
    if (!node) {
      throw apiError(404, "Folder not found");
    }

    depth += 1;
    currentId = node.parentFolderId;
  }

  return depth;
}

export function buildFolderBreadcrumbs(
  nodes: FolderTreeNode[],
  currentFolderId: string | null
): Array<{ id: string | null; title: string }> {
  const breadcrumbs: Array<{ id: string | null; title: string }> = [{ id: null, title: "HOME" }];
  if (!currentFolderId) return breadcrumbs;

  const byId = byIdMap(nodes);
  const chain: FolderTreeNode[] = [];
  let cursor: string | null = currentFolderId;
  const seen = new Set<string>();

  while (cursor) {
    if (seen.has(cursor)) {
      throw apiError(400, "Folder tree cycle detected");
    }
    seen.add(cursor);
    const node = byId.get(cursor);
    if (!node) {
      throw apiError(404, "Folder not found");
    }
    chain.push(node);
    cursor = node.parentFolderId;
  }

  chain.reverse().forEach((node) => breadcrumbs.push({ id: node.id, title: node.title }));
  return breadcrumbs;
}

export function collectFolderSubtreeIds(nodes: FolderTreeNode[], rootFolderId: string): string[] {
  const childrenByParent = new Map<string | null, FolderTreeNode[]>();
  for (const node of nodes) {
    const bucket = childrenByParent.get(node.parentFolderId) ?? [];
    bucket.push(node);
    childrenByParent.set(node.parentFolderId, bucket);
  }

  const ids: string[] = [];
  const stack = [rootFolderId];
  const seen = new Set<string>();

  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    for (const child of childrenByParent.get(current) ?? []) {
      stack.push(child.id);
    }
  }

  return ids;
}

export function assertFolderMoveAllowed(params: {
  nodes: FolderTreeNode[];
  folderId: string;
  nextParentFolderId: string | null;
}) {
  const { nodes, folderId, nextParentFolderId } = params;
  const byId = byIdMap(nodes);
  const source = byId.get(folderId);
  if (!source) {
    throw apiError(404, "Folder not found");
  }

  if (nextParentFolderId === folderId) {
    throw apiError(400, "Cannot move folder into itself");
  }

  if (nextParentFolderId) {
    const target = byId.get(nextParentFolderId);
    if (!target) {
      throw apiError(403, "Cannot use this folder");
    }

    let cursor: string | null = nextParentFolderId;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) {
        throw apiError(400, "Folder tree cycle detected");
      }
      seen.add(cursor);
      if (cursor === folderId) {
        throw apiError(400, "Cannot move folder into descendant");
      }
      cursor = byId.get(cursor)?.parentFolderId ?? null;
    }

    const targetDepth = getFolderDepthFromNodes(nodes, nextParentFolderId);

    const childrenByParent = new Map<string | null, FolderTreeNode[]>();
    for (const node of nodes) {
      const bucket = childrenByParent.get(node.parentFolderId) ?? [];
      bucket.push(node);
      childrenByParent.set(node.parentFolderId, bucket);
    }

    const subtreeDepth = (() => {
      function depthFrom(folderNodeId: string): number {
        const children = childrenByParent.get(folderNodeId) ?? [];
        if (!children.length) return 1;
        return 1 + Math.max(...children.map((child) => depthFrom(child.id)));
      }
      return depthFrom(folderId);
    })();

    if (targetDepth + subtreeDepth > MAX_FOLDER_DEPTH) {
      throw apiError(400, `Folder nesting depth exceeds ${MAX_FOLDER_DEPTH}`);
    }
  }
}

export function assertFolderCreateAllowed(nodes: FolderTreeNode[], parentFolderId: string | null) {
  if (!parentFolderId) return;
  const parentDepth = getFolderDepthFromNodes(nodes, parentFolderId);
  if (parentDepth + 1 > MAX_FOLDER_DEPTH) {
    throw apiError(400, `Folder nesting depth exceeds ${MAX_FOLDER_DEPTH}`);
  }
}

export function folderDepthForNode(nodes: FolderTreeNode[], folderId: string | null) {
  if (!folderId) return 0;
  return getFolderDepthFromNodes(nodes, folderId);
}
