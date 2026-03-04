import type { ArtistGoalType, TrackWorkbenchState } from "@prisma/client";

import type { LearnContextSurface, LearnMaterialDetail, LearnProblemType } from "@/lib/learn/types";

export type LearnMaterialRecord = Omit<LearnMaterialDetail, "progress" | "recommendedActions"> & {
  workflow: {
    stageOrders: number[];
    goalTypes: ArtistGoalType[];
    trackStates: TrackWorkbenchState[];
    problemTypes: LearnProblemType[];
    preferredSurfaces: LearnContextSurface[];
  };
};

export const LEARN_MOCK_MATERIALS: LearnMaterialRecord[] = [
  {
    id: "learn_01",
    slug: "mixing-vocals-charlie-puth-process-breakdown",
    type: "VIDEO",
    title: "Charlie Puth: vocal production decisions (breakdown)",
    authorName: "Charlie Puth",
    sourceName: "YouTube",
    summary:
      "Разбор подхода к вокальному продакшну: слои, гармонии, пространство, баланс эмоции и читаемости в поп-аранжировке.",
    thumbnailUrl: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg",
    tags: ["вокал", "продакшн", "аранжировка", "pop"],
    sourceUrl: "https://www.youtube.com/watch?v=09R8_2nJtjg",
    language: "en",
    durationMinutes: 9,
    provider: "YOUTUBE",
    embedUrl: "https://www.youtube.com/embed/09R8_2nJtjg",
    isFeatured: true,
    sortOrder: 10,
    workflow: {
      stageOrders: [3, 4, 5],
      goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
      trackStates: ["IN_PROGRESS", "STUCK"],
      problemTypes: ["MOMENTUM"],
      preferredSurfaces: ["SONGS", "TODAY"]
    }
  },
  {
    id: "learn_02",
    slug: "mix-with-the-masters-platform-reference",
    type: "ARTICLE",
    title: "Mix With The Masters (референс платформы обучения)",
    authorName: "Mix With The Masters",
    sourceName: "Mix With The Masters",
    summary:
      "Премиальная модель обучения через мастер-классы и разборы с топ-инженерами. Используем как референс структуры контента и подачи.",
    thumbnailUrl: "https://picsum.photos/seed/mwtm-reference/1200/675",
    tags: ["референс", "обучение", "сведение", "мастер-классы"],
    sourceUrl: "https://mixwiththemasters.com/",
    language: "en",
    readingMinutes: 4,
    provider: "WEB",
    isFeatured: true,
    sortOrder: 20,
    workflow: {
      stageOrders: [2, 3, 4, 5],
      goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
      trackStates: ["IN_PROGRESS", "READY_FOR_NEXT_STEP"],
      problemTypes: ["DIRECTION", "MOMENTUM"],
      preferredSurfaces: ["LEARN", "GOALS"]
    }
  },
  {
    id: "learn_03",
    slug: "studio-charlie-puth-class-reference",
    type: "ARTICLE",
    title: "Studio.com x Charlie Puth (референс course experience)",
    authorName: "Studio.com",
    sourceName: "Studio.com",
    summary:
      "Референс формата creator-led курса: лендинг, модули, ценностное предложение, визуальная подача и конверсионные элементы.",
    thumbnailUrl: "https://picsum.photos/seed/studio-charlie/1200/675",
    tags: ["референс", "курс", "creator", "ux"],
    sourceUrl:
      "https://studio.com/apps/studio/charlie-puth?ref=CHARLIEPUTH&code=a&utm_source=charlie&utm_medium=creator#!",
    language: "en",
    readingMinutes: 5,
    provider: "WEB",
    isFeatured: true,
    sortOrder: 30,
    workflow: {
      stageOrders: [1, 2, 3],
      goalTypes: ["CUSTOM_CAREER", "ALBUM_RELEASE"],
      trackStates: ["IN_PROGRESS", "READY_FOR_NEXT_STEP"],
      problemTypes: ["DIRECTION"],
      preferredSurfaces: ["GOALS", "LEARN"]
    }
  },
  {
    id: "learn_04",
    slug: "songwriting-hook-structure-pop-lesson",
    type: "VIDEO",
    title: "Songwriting: hooks, contrast and chorus lift",
    authorName: "Songwriting Academy",
    sourceName: "YouTube",
    summary:
      "Практические принципы построения цепляющего припева и контраста куплет/припев без перегруза аранжировки.",
    thumbnailUrl: "https://i.ytimg.com/vi/fLexgOxsZu0/hqdefault.jpg",
    tags: ["сонграйтинг", "припев", "структура", "pop"],
    sourceUrl: "https://www.youtube.com/watch?v=fLexgOxsZu0",
    language: "en",
    durationMinutes: 11,
    provider: "YOUTUBE",
    embedUrl: "https://www.youtube.com/embed/fLexgOxsZu0",
    isFeatured: false,
    sortOrder: 40,
    workflow: {
      stageOrders: [1, 2, 3],
      goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
      trackStates: ["IN_PROGRESS", "STUCK"],
      problemTypes: ["DIRECTION", "MOMENTUM"],
      preferredSurfaces: ["SONGS", "TODAY"]
    }
  },
  {
    id: "learn_05",
    slug: "home-studio-acoustics-basics-for-artists",
    type: "ARTICLE",
    title: "База домашней акустики: что реально влияет на запись",
    authorName: "ART SAFE Editorial",
    sourceName: "Acoustics Notes",
    summary:
      "Короткий гид по первым улучшениям комнаты: позиция мониторов, точки отражений, рабочая зона записи вокала и типичные ошибки.",
    thumbnailUrl: "https://picsum.photos/seed/acoustics-basics/1200/675",
    tags: ["акустика", "home studio", "запись", "вокал"],
    sourceUrl: "https://www.soundonsound.com/techniques/studio-sos-making-most-small-room",
    language: "ru",
    readingMinutes: 8,
    provider: "WEB",
    embedUrl: "https://example.com/",
    isFeatured: false,
    sortOrder: 50,
    workflow: {
      stageOrders: [1, 2, 4],
      goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
      trackStates: ["IN_PROGRESS", "STUCK"],
      problemTypes: ["MOMENTUM"],
      preferredSurfaces: ["SONGS", "LEARN"]
    }
  },
  {
    id: "learn_06",
    slug: "compression-for-vocals-artist-friendly-explainer",
    type: "VIDEO",
    title: "Compression for vocals: artist-friendly explainer",
    authorName: "Audio Training",
    sourceName: "YouTube",
    summary:
      "Понятное объяснение компрессии на вокале: атака, релиз, ratio и как слушать эффект в контексте трека, а не на соло.",
    thumbnailUrl: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg",
    tags: ["компрессия", "вокал", "сведение", "динамика"],
    sourceUrl: "https://www.youtube.com/watch?v=YQHsXMglC9A",
    language: "en",
    durationMinutes: 13,
    provider: "YOUTUBE",
    embedUrl: "https://www.youtube.com/embed/YQHsXMglC9A",
    isFeatured: true,
    sortOrder: 60,
    workflow: {
      stageOrders: [4, 5],
      goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
      trackStates: ["IN_PROGRESS", "STUCK"],
      problemTypes: ["MOMENTUM", "FEEDBACK"],
      preferredSurfaces: ["SONGS", "TODAY"]
    }
  },
  {
    id: "learn_07",
    slug: "release-planning-checklist-independent-artist",
    type: "ARTICLE",
    title: "Чеклист релиз-планирования для независимого артиста",
    authorName: "ART SAFE Editorial",
    sourceName: "ART SAFE Notes",
    summary:
      "Референсный чеклист: дата релиза, контент-план, assets, дедлайны мастеринга/дистрибуции и коммуникация с командой.",
    thumbnailUrl: "https://picsum.photos/seed/release-planning/1200/675",
    tags: ["релиз", "менеджмент", "планирование", "дистрибуция"],
    sourceUrl: "https://artists.spotify.com/en/blog/music-release-planning-guide",
    language: "ru",
    readingMinutes: 7,
    provider: "WEB",
    isFeatured: false,
    sortOrder: 70,
    workflow: {
      stageOrders: [5, 6, 7],
      goalTypes: ["ALBUM_RELEASE", "MINI_TOUR", "FESTIVAL_RUN", "SOLO_SHOW"],
      trackStates: ["READY_FOR_NEXT_STEP", "IN_PROGRESS"],
      problemTypes: ["RELEASE_PLANNING"],
      preferredSurfaces: ["GOALS", "SONGS", "TODAY"]
    }
  },
  {
    id: "learn_08",
    slug: "arrangement-energy-map-verse-to-chorus",
    type: "VIDEO",
    title: "Arrangement energy map: verse to chorus lift",
    authorName: "Production Breakdown",
    sourceName: "YouTube",
    summary:
      "Как строить рост энергии по секциям: плотность, спектр, ритмическая активность и роль пауз в аранжировке.",
    thumbnailUrl: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg",
    tags: ["аранжировка", "энергия", "структура", "продакшн"],
    sourceUrl: "https://www.youtube.com/watch?v=60ItHLz5WEA",
    language: "en",
    durationMinutes: 12,
    provider: "YOUTUBE",
    embedUrl: "https://www.youtube.com/embed/60ItHLz5WEA",
    isFeatured: false,
    sortOrder: 80,
    workflow: {
      stageOrders: [2, 3],
      goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
      trackStates: ["STUCK", "READY_FOR_NEXT_STEP"],
      problemTypes: ["MOMENTUM", "FEEDBACK"],
      preferredSurfaces: ["SONGS", "TODAY"]
    }
  }
];
