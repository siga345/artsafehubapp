import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { DAILY_TODO_MAX_ITEMS, normalizeDailyTodoInput, patchDailyTodoItems, serializeDailyTodo } from "@/lib/home-today";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const dailyTodoItemSchema = z.object({
  id: z.string().trim().max(100).optional(),
  text: z.string().max(280).optional(),
  isCompleted: z.boolean().optional(),
  sortIndex: z.number().int().min(0).max(DAILY_TODO_MAX_ITEMS - 1).optional(),
  completedAt: z.string().datetime().optional().nullable()
});

const putSchema = z.object({
  items: z.array(dailyTodoItemSchema).max(DAILY_TODO_MAX_ITEMS * 2)
});

const patchSchema = z
  .object({
    id: z.string().trim().min(1),
    text: z.string().max(280).optional(),
    isCompleted: z.boolean().optional(),
    sortIndex: z.number().int().min(0).max(DAILY_TODO_MAX_ITEMS - 1).optional()
  })
  .refine((value) => value.text !== undefined || value.isCompleted !== undefined || value.sortIndex !== undefined, {
    message: "Нужно передать хотя бы одно поле для обновления."
  });

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());

  const dailyTodo = await prisma.dailyTodo.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date: today
      }
    }
  });

  return NextResponse.json(serializeDailyTodo(today, dailyTodo?.items ?? []));
});

export const PUT = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, putSchema);
  const today = toDateOnly(new Date());
  const normalizedItems = normalizeDailyTodoInput(body.items, new Date());

  const dailyTodo = await prisma.dailyTodo.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: today
      }
    },
    update: {
      items: normalizedItems as Prisma.InputJsonValue
    },
    create: {
      userId: user.id,
      date: today,
      items: normalizedItems as Prisma.InputJsonValue
    }
  });

  return NextResponse.json(serializeDailyTodo(today, dailyTodo.items));
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, patchSchema);
  const today = toDateOnly(new Date());

  const dailyTodo = await prisma.dailyTodo.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date: today
      }
    }
  });

  if (!dailyTodo) {
    throw apiError(404, "Today to-do for this day not found.");
  }

  const nextItems = patchDailyTodoItems(dailyTodo.items, body, new Date());
  const updated = await prisma.dailyTodo.update({
    where: { id: dailyTodo.id },
    data: {
      items: nextItems as Prisma.InputJsonValue
    }
  });

  return NextResponse.json(serializeDailyTodo(today, updated.items));
});
