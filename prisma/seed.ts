import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { findTestProfiles } from "./test-find-profiles";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await prisma.$executeRaw`TRUNCATE TABLE
    "LearnMaterial",
    "LearnMaterialProgress",
    "LearnApplication",
    "TrackDistributionRequest",
    "InAppRequestAction",
    "InAppRequest",
    "CommunityFeedbackReplyItem",
    "CommunityFeedbackReply",
    "CommunityFeedbackThread",
    "FeedbackResolution",
    "FeedbackItem",
    "FeedbackRequest",
    "TrackDecision",
    "VersionReflection",
    "TrackIntent",
    "RecommendationEvent",
    "DailyWrapUp",
    "DailyTrackFocus",
    "TrackNextStep",
    "Demo",
    "CommunityPost",
    "CommunityAchievement",
    "CommunityLike",
    "CommunityEvent",
    "GoalTask",
    "GoalPillar",
    "DailyFocus",
    "ArtistGoal",
    "Track",
    "Project",
    "Folder",
    "ArtistWorldProject",
    "ArtistWorldReference",
    "ArtistIdentityProfile",
    "UserOnboardingState",
    "FeaturedCreator",
    "Friendship",
    "DailyCheckIn",
    "DailyMicroStep",
    "WeeklyActivity",
    "SpecialistProfile",
    "User",
    "PathStage"
    CASCADE`;

  await prisma.pathStage.createMany({
    data: [
      {
        order: 1,
        name: "Искра",
        iconKey: "spark",
        description: "Творческий порыв"
      },
      {
        order: 2,
        name: "Формирование",
        iconKey: "mic",
        description: "Становление бренда"
      },
      {
        order: 3,
        name: "Выход в свет",
        iconKey: "knobs",
        description: "Первые успехи"
      },
      {
        order: 4,
        name: "Прорыв",
        iconKey: "record",
        description: "Закрепление влияния"
      },
      {
        order: 5,
        name: "Признание",
        iconKey: "sliders",
        description: "Стабильная аудитория"
      },
      {
        order: 6,
        name: "Широкая известность",
        iconKey: "wave",
        description: "Медийный масштаб"
      },
      {
        order: 7,
        name: "Наследие",
        iconKey: "rocket",
        description: "Культурное влияние"
      }
    ]
  });

  const stages = await prisma.pathStage.findMany({ orderBy: { order: "asc" } });
  const sparkStage = stages.find((stage: { order: number }) => stage.order === 1);
  const formationStage = stages.find((stage: { order: number }) => stage.order === 2);
  const firstSuccessStage = stages.find((stage: { order: number }) => stage.order === 3);
  const breakthroughStage = stages.find((stage: { order: number }) => stage.order === 4);
  if (!sparkStage || !formationStage || !firstSuccessStage || !breakthroughStage) {
    throw new Error("Required PATH stages are missing after seed setup.");
  }

  const user = await prisma.user.create({
    data: {
      email: "demo@artsafehub.app",
      passwordHash,
      nickname: "Demo Artist",
      safeId: "SAFE-DEMO-001",
      role: "ARTIST",
      pathStageId: breakthroughStage.id,
      links: {
        telegram: "https://t.me/demo_artist",
        youtube: "https://youtube.com/@demoartist"
      }
    }
  });

  await prisma.artistIdentityProfile.create({
    data: {
      userId: user.id,
      identityStatement: "Пишу ночные песни про движение, уязвимость и внутренний свет.",
      mission: "Собирать вокруг музыки пространство, где честность не маскируют.",
      philosophy: "Лучший релиз начинается с честного внутреннего ритма.",
      coreThemes: ["ночь", "уязвимость", "движение"],
      aestheticKeywords: ["urban glow", "cinematic", "soft grit"]
    }
  });

  const folder = await prisma.folder.create({
    data: {
      userId: user.id,
      title: "Новый релиз"
    }
  });

  const track = await prisma.track.create({
    data: {
      userId: user.id,
      folderId: folder.id,
      title: "Night Ride",
      pathStageId: formationStage.id
    }
  });

  await prisma.demo.createMany({
    data: [
      {
        trackId: track.id,
        audioUrl: "uploads/2026/02/12/demo-night-ride-v1.webm",
        textNote: "Черновой хук + ритм слога.",
        duration: 34
      },
      {
        trackId: track.id,
        audioUrl: "uploads/2026/02/12/demo-night-ride-v2.webm",
        textNote: "Вариант припева с другой мелодией.",
        duration: 41
      }
    ]
  });

  const today = new Date();
  const dateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);

  await prisma.dailyCheckIn.create({
    data: {
      userId: user.id,
      date: dateOnly,
      mood: "NORMAL",
      note: "Двигаюсь мягко, но стабильно."
    }
  });

  await prisma.dailyMicroStep.create({
    data: {
      userId: user.id,
      date: dateOnly,
      pathStageId: firstSuccessStage.id,
      text: "Собери 3 референса для продакшна.",
      isCompleted: false
    }
  });

  await prisma.weeklyActivity.create({
    data: {
      userId: user.id,
      weekStartDate,
      activeDays: 3
    }
  });

  const createdSpecialists: Array<{ id: string; nickname: string; safeId: string }> = [];

  for (const specialist of findTestProfiles) {
    const createdUser = await prisma.user.create({
      data: {
        email: specialist.email,
        passwordHash,
        nickname: specialist.nickname,
        safeId: specialist.safeId,
        role: specialist.role,
        pathStageId: sparkStage.id
      }
    });

    await prisma.specialistProfile.create({
      data: {
        userId: createdUser.id,
        category: specialist.category,
        city: specialist.city,
        metro: specialist.metro,
        isOnline: specialist.isOnline,
        isAvailableNow: specialist.isAvailableNow,
        bio: specialist.bio,
        portfolioLinks: specialist.portfolioLinks,
        services: specialist.services,
        credits: specialist.credits,
        budgetFrom: specialist.budgetFrom,
        contactTelegram: specialist.contactTelegram,
        contactUrl: specialist.contactUrl
      }
    });

    createdSpecialists.push({
      id: createdUser.id,
      nickname: createdUser.nickname,
      safeId: createdUser.safeId
    });
  }

  const featuredSpecialists = createdSpecialists.slice(0, 3);
  for (const [index, creator] of [user, ...featuredSpecialists].entries()) {
    await prisma.featuredCreator.create({
      data: {
        userId: creator.id,
        sortIndex: index,
        reason:
          creator.id === user.id
            ? "Рекомендуем обратить внимание на путь и новые версии."
            : "Выбранный creator недели."
      }
    });
  }

  if (featuredSpecialists[0]) {
    await prisma.friendship.create({
      data: {
        requesterUserId: user.id,
        addresseeUserId: featuredSpecialists[0].id,
        status: "ACCEPTED",
        respondedAt: new Date()
      }
    });
  }

  if (featuredSpecialists[1]) {
    await prisma.friendship.create({
      data: {
        requesterUserId: featuredSpecialists[1].id,
        addresseeUserId: user.id,
        status: "PENDING"
      }
    });
  }

  await prisma.communityPost.create({
    data: {
      authorUserId: user.id,
      text: "Закрепил новый референс-пак и докрутил настроение для следующей версии Night Ride."
    }
  });

  await prisma.communityAchievement.create({
    data: {
      userId: user.id,
      type: "TRACK_CREATED",
      title: "Новый трек в работе",
      body: "Добавлен трек «Night Ride».",
      dedupeKey: `track_created:${track.id}`,
      sourceTrackId: track.id,
      metadata: {
        trackTitle: track.title
      }
    }
  });

  await prisma.communityEvent.createMany({
    data: [
      {
        title: "Listening Circle: February Cuts",
        slug: "listening-circle-february-cuts",
        description: "Редакторский онлайн-разбор новых демок и релизных подходов внутри сообщества.",
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
        isOnline: true,
        hostLabel: "ART SAFE PLACE",
        status: "PUBLISHED"
      },
      {
        title: "Creator Meetup: Moscow Session",
        slug: "creator-meetup-moscow-session",
        description: "Оффлайн-встреча креаторов, обмен опытом по команде, пути и релизному циклу.",
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6),
        city: "Москва",
        isOnline: false,
        hostLabel: "ART SAFE PLACE",
        status: "PUBLISHED"
      }
    ]
  });

  await prisma.learnMaterial.createMany({
    data: [
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
        stageOrders: [3, 4, 5],
        goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
        trackStates: ["IN_PROGRESS", "STUCK"],
        problemTypes: ["MOMENTUM"],
        preferredSurfaces: ["SONGS", "TODAY"]
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
        stageOrders: [2, 3, 4, 5],
        goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
        trackStates: ["IN_PROGRESS", "READY_FOR_NEXT_STEP"],
        problemTypes: ["DIRECTION", "MOMENTUM"],
        preferredSurfaces: ["LEARN", "GOALS"]
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
        stageOrders: [1, 2, 3],
        goalTypes: ["CUSTOM_CAREER", "ALBUM_RELEASE"],
        trackStates: ["IN_PROGRESS", "READY_FOR_NEXT_STEP"],
        problemTypes: ["DIRECTION"],
        preferredSurfaces: ["GOALS", "LEARN"]
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
        stageOrders: [1, 2, 3],
        goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
        trackStates: ["IN_PROGRESS", "STUCK"],
        problemTypes: ["DIRECTION", "MOMENTUM"],
        preferredSurfaces: ["SONGS", "TODAY"]
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
        stageOrders: [1, 2, 4],
        goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
        trackStates: ["IN_PROGRESS", "STUCK"],
        problemTypes: ["MOMENTUM"],
        preferredSurfaces: ["SONGS", "LEARN"]
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
        stageOrders: [4, 5],
        goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
        trackStates: ["IN_PROGRESS", "STUCK"],
        problemTypes: ["MOMENTUM", "FEEDBACK"],
        preferredSurfaces: ["SONGS", "TODAY"]
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
        stageOrders: [5, 6, 7],
        goalTypes: ["ALBUM_RELEASE", "MINI_TOUR", "FESTIVAL_RUN", "SOLO_SHOW"],
        trackStates: ["READY_FOR_NEXT_STEP", "IN_PROGRESS"],
        problemTypes: ["RELEASE_PLANNING"],
        preferredSurfaces: ["GOALS", "SONGS", "TODAY"]
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
        stageOrders: [2, 3],
        goalTypes: ["ALBUM_RELEASE", "CUSTOM_CAREER"],
        trackStates: ["STUCK", "READY_FOR_NEXT_STEP"],
        problemTypes: ["MOMENTUM", "FEEDBACK"],
        preferredSurfaces: ["SONGS", "TODAY"]
      }
    ]
  });

  console.log("Seed data created", {
    pathStages: stages.length,
    artist: user.email,
    tracks: 1,
    demos: 2,
    specialists: findTestProfiles.length,
    featuredCreators: 4,
    events: 2,
    learnMaterials: 8
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
