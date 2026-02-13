import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const stageFallback = {
  id: 0,
  order: 1,
  name: "Идея",
  iconKey: "spark",
  description: "Сформулируй, что ты хочешь сказать треком."
};

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());
  const weekStartDate = getWeekStart(today);

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { pathStage: true }
  });

  const currentStage = currentUser?.pathStage ?? stageFallback;

  const [checkIn, microStep, weeklyActivity] = await Promise.all([
    prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } }
    }),
    prisma.dailyMicroStep.findUnique({
      where: { userId_date: { userId: user.id, date: today } }
    }),
    prisma.weeklyActivity.findUnique({
      where: { userId_weekStartDate: { userId: user.id, weekStartDate } }
    })
  ]);

  return NextResponse.json({
    today: today.toISOString(),
    stage: currentStage,
    checkIn,
    microStep,
    weeklyActiveDays: Math.max(0, Math.min(7, weeklyActivity?.activeDays ?? 0))
  });
});
