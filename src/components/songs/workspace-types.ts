export type WorkspacePreviewItem =
  | {
      id: string;
      type: "folder";
      title: string;
    }
  | {
      id: string;
      type: "project";
      title: string;
      coverType: "GRADIENT" | "IMAGE";
      coverImageUrl?: string | null;
      coverColorA?: string | null;
      coverColorB?: string | null;
    };

export type WorkspaceFolderNode = {
  id: string;
  type: "folder";
  title: string;
  pinnedAt: string | null;
  updatedAt: string;
  sortIndex: number;
  itemCount: number;
  preview: WorkspacePreviewItem[];
};

export type WorkspaceProjectNode = {
  id: string;
  type: "project";
  title: string;
  pinnedAt: string | null;
  updatedAt: string;
  sortIndex: number;
  projectMeta: {
    artistLabel?: string | null;
    coverType: "GRADIENT" | "IMAGE";
    coverImageUrl?: string | null;
    coverColorA?: string | null;
    coverColorB?: string | null;
    trackCount: number;
  };
};

export type WorkspaceNode = WorkspaceFolderNode | WorkspaceProjectNode;

export type WorkspaceNodesResponse = {
  currentFolder: { id: string; title: string; parentFolderId: string | null; depth: number } | null;
  breadcrumbs: Array<{ id: string | null; title: string }>;
  nodes: WorkspaceNode[];
};

export type FolderListItem = {
  id: string;
  title: string;
  parentFolderId: string | null;
  pinnedAt?: string | null;
  sortIndex?: number;
  _count?: { childFolders?: number; projects?: number; tracks?: number };
};
