import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const stagePrompts: Record<string, string[]> = {
  "Идея": [
    "Запиши 20 секунд идеи без оценки.",
    "Сформулируй тему трека в одной фразе.",
    "Набросай 3 референса по настроению."
  ],
  "Демо": [
    "Запиши новый дубль припева.",
    "Сделай короткую демку куплета.",
    "Проверь ритм текста под бит."
  ],
  "Продакшн": [
    "Собери 3 референса продакшна.",
    "Определи темп и тональность.",
    "Собери структуру трека в 4 блока."
  ],
  "Запись": [
    "Запиши тестовый тейк куплета.",
    "Проверь дыхание и опоры в сложных строках.",
    "Собери список правок перед финальным дублем."
  ],
  "Сведение": [
    "Сделай черновой баланс громкостей.",
    "Проверь читаемость вокала в припеве.",
    "Сравни микс с одним референсом."
  ],
  "Мастеринг": [
    "Проверь итоговую громкость на 2 устройствах.",
    "Сверь тональный баланс с референсом.",
    "Подготовь финальный экспорт мастера."
  ],
  "Релиз": [
    "Проверь метаданные релиза.",
    "Подготовь обложку и описание.",
    "Назначь дату публикации."
  ],
  "Промо-съёмка": [
    "Составь короткий план съёмки.",
    "Подбери 1 локацию и 1 образ.",
    "Сделай список кадров для ролика."
  ],
  "Выпуск промо": [
    "Опубликуй один промо-тизер.",
    "Подготовь подпись для поста.",
    "Отправь трек 3 релевантным контактам."
  ]
};

function pickMicroStep(stageName: string, seed: number): string {
  const prompts = stagePrompts[stageName] ?? stagePrompts["Идея"];
  return prompts[seed % prompts.length];
}

export const POST = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { pathStage: true }
  });

  const stageName = currentUser?.pathStage?.name ?? "Идея";
  const existing = await prisma.dailyMicroStep.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });

  const nextSeed = existing ? existing.text.length + Number(existing.isCompleted) + 1 : Date.now();
  const nextText = pickMicroStep(stageName, nextSeed);

  const microStep = await prisma.dailyMicroStep.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    update: {
      text: nextText,
      isCompleted: false,
      completedAt: null,
      pathStageId: currentUser?.pathStageId ?? null
    },
    create: {
      userId: user.id,
      date: today,
      text: nextText,
      isCompleted: false,
      pathStageId: currentUser?.pathStageId ?? null
    }
  });

  return NextResponse.json(microStep, { status: 201 });
});

export const PATCH = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());

  const microStep = await prisma.dailyMicroStep.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });

  if (!microStep) {
    throw apiError(404, "Micro-step for today not found");
  }

  const updated = await prisma.dailyMicroStep.update({
    where: { id: microStep.id },
    data: {
      isCompleted: true,
      completedAt: new Date()
    }
  });

  return NextResponse.json(updated);
});
