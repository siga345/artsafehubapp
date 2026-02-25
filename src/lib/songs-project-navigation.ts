export type ProjectReleaseKind = "SINGLE" | "ALBUM";

export type ProjectOpenNavigationInput = {
  id: string;
  releaseKind?: ProjectReleaseKind | null;
  singleTrackId?: string | null;
};

export function getProjectOpenHref(project: ProjectOpenNavigationInput) {
  if (project.releaseKind === "SINGLE" && project.singleTrackId) {
    return `/songs/${project.singleTrackId}`;
  }
  return `/songs/projects/${project.id}`;
}

