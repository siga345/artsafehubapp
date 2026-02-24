export type CanonicalPathStageLabel = {
  name: string;
  description: string;
  iconKey: string;
};

export const canonicalPathStageByOrder: Record<number, CanonicalPathStageLabel> = {
  1: { name: "Искра", description: "Творческий порыв", iconKey: "spark" },
  2: { name: "Формирование", description: "Становление бренда", iconKey: "mic" },
  3: { name: "Выход в свет", description: "Первые успехи", iconKey: "knobs" },
  4: { name: "Прорыв", description: "Закрепление влияния", iconKey: "record" },
  5: { name: "Признание", description: "Стабильная аудитория", iconKey: "sliders" },
  6: { name: "Широкая известность", description: "Медийный масштаб", iconKey: "wave" },
  7: { name: "Наследие", description: "Культурное влияние", iconKey: "rocket" }
};

const legacyToCanonicalName: Record<string, string> = {
  "Идея": "Искра",
  "Демо": "Формирование",
  "Продакшн": "Выход в свет",
  "Запись": "Прорыв",
  "Сведение": "Признание",
  "Мастеринг": "Широкая известность",
  "Релиз": "Наследие"
};

export function getCanonicalPathStageLabel(order?: number | null): CanonicalPathStageLabel | undefined {
  if (!order) return undefined;
  return canonicalPathStageByOrder[order];
}

export function getCanonicalPathStageName(input: { order?: number | null; name?: string | null }): string | undefined {
  const byOrder = getCanonicalPathStageLabel(input.order)?.name;
  if (byOrder) return byOrder;
  const rawName = input.name?.trim();
  if (!rawName) return undefined;
  return legacyToCanonicalName[rawName] ?? rawName;
}

export function canonicalizePathStage<T extends { order: number; name: string; description: string; iconKey: string }>(
  stage: T
): T {
  const canonical = getCanonicalPathStageLabel(stage.order);
  if (!canonical) return stage;
  return {
    ...stage,
    name: canonical.name,
    description: canonical.description,
    iconKey: canonical.iconKey
  };
}
