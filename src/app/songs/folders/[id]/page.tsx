"use client";

import { WorkspaceBrowser } from "@/components/songs/workspace-browser";

export default function SongsFolderPage({ params }: { params: { id: string } }) {
  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
        <div className="mb-4 rounded-2xl border border-brand-border bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
          <p className="text-sm text-brand-muted">
            Папка открывается в рабочем режиме: поиск, breadcrumbs, создание папок/проектов и действия доступны в одном header ниже.
          </p>
        </div>
        <WorkspaceBrowser parentFolderId={params.id} />
      </div>
    </div>
  );
}
