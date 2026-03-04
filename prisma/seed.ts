import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { findTestProfiles } from "./test-find-profiles";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await prisma.demo.deleteMany();
  await prisma.communityLike.deleteMany();
  await prisma.communityAchievement.deleteMany();
  await prisma.communityPost.deleteMany();
  await prisma.communityEvent.deleteMany();
  await prisma.featuredCreator.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.track.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.artistIdentityProfile.deleteMany();
  await prisma.dailyCheckIn.deleteMany();
  await prisma.dailyMicroStep.deleteMany();
  await prisma.weeklyActivity.deleteMany();
  await prisma.specialistProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pathStage.deleteMany();

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

  console.log("Seed data created", {
    pathStages: stages.length,
    artist: user.email,
    tracks: 1,
    demos: 2,
    specialists: findTestProfiles.length,
    featuredCreators: 4,
    events: 2
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
