import { PrismaClient, SongStatus, TaskStatus, BookingStatus, LearningType, PathLogType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const pathLevels = await prisma.pathLevel.createMany({
    data: [
      {
        order: 1,
        name: "Idea Collector",
        description: "Capture 10 raw ideas and define your sound.",
        criteria: { ideas: 10 },
        checklistTemplate: { prompts: ["Record 3 voice memos", "Write 1 verse"] }
      },
      {
        order: 2,
        name: "Song Builder",
        description: "Turn 3 ideas into full song drafts.",
        criteria: { drafts: 3 },
        checklistTemplate: { prompts: ["Select reference track", "Finish hook"] }
      },
      {
        order: 3,
        name: "Release Ready",
        description: "Prepare your first release package.",
        criteria: { releases: 1 },
        checklistTemplate: { prompts: ["Artwork brief", "Mastered export"] }
      }
    ]
  });

  const firstLevel = await prisma.pathLevel.findFirst({ where: { order: 1 } });

  const user = await prisma.user.create({
    data: {
      email: "demo@artsafehub.app",
      passwordHash,
      name: "Demo Artist",
      role: "ARTIST",
      pathLevelId: firstLevel?.id,
      artistProfile: {
        create: {
          genres: ["Hip-Hop", "Pop"],
          city: "Almaty",
          bio: "Beginner artist exploring melodic rap.",
          links: { instagram: "https://instagram.com/demo" },
          availability: "OPEN"
        }
      }
    }
  });

  const song = await prisma.song.create({
    data: {
      ownerId: user.id,
      title: "Neon Streetlights",
      description: "Draft chorus, verse ideas, and mood references.",
      status: SongStatus.WRITING,
      bpm: 92,
      key: "Am"
    }
  });

  await prisma.task.createMany({
    data: [
      {
        ownerId: user.id,
        songId: song.id,
        title: "Finish verse 1",
        description: "Write full lyrics for the first verse.",
        status: TaskStatus.DOING
      },
      {
        ownerId: user.id,
        title: "Define weekly practice slots",
        description: "Block 3 sessions for writing this week.",
        status: TaskStatus.TODO,
        pathLevelId: firstLevel?.id ?? null
      }
    ]
  });

  await prisma.idea.create({
    data: {
      ownerId: user.id,
      title: "Night ride hook",
      text: "*Hook idea:* \n\nLate-night city lights...",
      tags: ["hook", "melodic"]
    }
  });

  await prisma.pathProgressLog.create({
    data: {
      userId: user.id,
      type: PathLogType.NOTE,
      text: "Committed to writing every Tuesday and Friday."
    }
  });

  await prisma.booking.create({
    data: {
      userId: user.id,
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      status: BookingStatus.REQUESTED,
      notes: "Looking for a 1-hour vocal recording slot."
    }
  });

  await prisma.learningItem.createMany({
    data: [
      {
        type: LearningType.VIDEO,
        title: "Writing hooks for beginners",
        description: "Short tutorial on memorable hooks.",
        url: "https://example.com/hooks",
        tags: ["writing", "hooks"],
        pathLevelIds: [firstLevel?.id ?? 1],
        songStatuses: [SongStatus.WRITING]
      },
      {
        type: LearningType.TEXT,
        title: "Mix prep checklist",
        description: "How to organize stems before mixing.",
        url: "https://example.com/mix-prep",
        tags: ["mixing"],
        pathLevelIds: [2],
        songStatuses: [SongStatus.MIXING]
      }
    ]
  });

  console.log("Seed data created", { pathLevels, user: user.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
