import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const checkInSchema = z.object({
  mood: z.enum(["NORMAL", "TOUGH", "FLYING"]),
  note: z.string().max(280).optional().nullable()
});

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getWeekStart(dateOnly: Date) {
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);
  return weekStartDate;
}

export const PUT = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, checkInSchema);
  const today = toDateOnly(new Date());
  const weekStartDate = getWeekStart(today);

  const checkIn = await prisma.dailyCheckIn.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    update: {
      mood: body.mood,
      note: body.note ?? null
    },
    create: {
      userId: user.id,
      date: today,
      mood: body.mood,
      note: body.note ?? null
    }
  });

  const weekCheckInsCount = await prisma.dailyCheckIn.count({
    where: {
      userId: user.id,
      date: {
        gte: weekStartDate,
        lte: today
      }
    }
  });

  await prisma.weeklyActivity.upsert({
    where: { userId_weekStartDate: { userId: user.id, weekStartDate } },
    update: {
      activeDays: Math.max(0, Math.min(7, weekCheckInsCount))
    },
    create: {
      userId: user.id,
      weekStartDate,
      activeDays: Math.max(0, Math.min(7, weekCheckInsCount))
    }
  });

  return NextResponse.json(checkIn);
});
