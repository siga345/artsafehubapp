"use client";

import { WorkspaceBrowser } from "@/components/songs/workspace-browser";

export default function SongsFolderPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6 pb-12">
      <WorkspaceBrowser parentFolderId={params.id} />
    </div>
  );
}
