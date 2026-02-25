export type SongStageLike = {
  id: number;
  name: string;
};

export type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED" | "RELEASE";

export function normalizeSongStageName(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isPromoSongStage(name: string) {
  return normalizeSongStageName(name).includes("промо");
}

export function isIdeaSongStage(name: string) {
  const stageName = normalizeSongStageName(name);
  return stageName.includes("идея") || stageName.includes("искра");
}

export function isDemoSongStage(name: string) {
  const stageName = normalizeSongStageName(name);
  return stageName.includes("формирован") || stageName.includes("становлен") || stageName.includes("демо");
}

export function isReleaseSongStage(name: string) {
  const stageName = normalizeSongStageName(name);
  return (
    stageName.includes("релиз") ||
    stageName.includes("дистр") ||
    stageName.includes("наслед") ||
    stageName.includes("культурн") ||
    stageName.includes("влияни")
  );
}

export function isSelectableSongCreationStage(stage: SongStageLike) {
  return !isPromoSongStage(stage.name) && !isIdeaSongStage(stage.name);
}

export function findIdeaStage(stages: SongStageLike[] | undefined) {
  return (stages ?? []).find((stage) => isIdeaSongStage(stage.name)) ?? null;
}

export function findDemoStage(stages: SongStageLike[] | undefined) {
  return (stages ?? []).find((stage) => isDemoSongStage(stage.name)) ?? null;
}

export function resolveVersionTypeByStage(stage: SongStageLike): DemoVersionType | null {
  const stageName = normalizeSongStageName(stage.name);

  if (isIdeaSongStage(stage.name)) return "IDEA_TEXT";
  if (isDemoSongStage(stage.name)) return "DEMO";
  if (
    stageName.includes("выход в свет") ||
    stageName.includes("первые успех") ||
    stageName.includes("продакшн") ||
    stageName.includes("аранж")
  ) {
    return "ARRANGEMENT";
  }
  if (stageName.includes("прорыв") || stageName.includes("закреплен") || stageName.includes("запис")) {
    return "NO_MIX";
  }
  if (stageName.includes("признан") || stageName.includes("аудитор") || stageName.includes("свед")) {
    return "MIXED";
  }
  if (stageName.includes("широкая известность") || stageName.includes("медийн") || stageName.includes("мастер")) {
    return "MASTERED";
  }
  if (isReleaseSongStage(stage.name)) return "RELEASE";

  return null;
}
