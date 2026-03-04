"use client";

import { WorkspaceBrowser } from "@/components/songs/workspace-browser";

export default function SongsFolderPage({ params }: { params: { id: string } }) {
  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
        <WorkspaceBrowser parentFolderId={params.id} />
      </div>
    </div>
  );
}
