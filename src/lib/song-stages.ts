export type CanonicalSongStageLabel = {
  name: string;
  description: string;
  iconKey: string;
};

export const canonicalSongStageByOrder: Record<number, CanonicalSongStageLabel> = {
  1: { name: "Идея", description: "Зафиксируй ядро трека: тема, эмоция и хук.", iconKey: "spark" },
  2: { name: "Демо", description: "Собери первые демки и черновой вайб песни.", iconKey: "mic" },
  3: { name: "Продакшн", description: "Подготовь продакшн и направление трека.", iconKey: "knobs" },
  4: { name: "Запись", description: "Запиши вокал и ключевые дорожки.", iconKey: "record" },
  5: { name: "Сведение", description: "Собери цельный микс с нужным балансом.", iconKey: "sliders" },
  6: { name: "Мастеринг", description: "Подготовь финальный мастер для площадок.", iconKey: "wave" },
  7: { name: "Релиз", description: "Выпусти трек и опубликуй на площадках.", iconKey: "rocket" }
};

export function canonicalizeSongStage<T extends { order: number; name: string; description: string; iconKey: string }>(
  stage: T
): T {
  const canonical = canonicalSongStageByOrder[stage.order];
  if (!canonical) return stage;
  return {
    ...stage,
    name: canonical.name,
    description: canonical.description,
    iconKey: canonical.iconKey
  };
}
