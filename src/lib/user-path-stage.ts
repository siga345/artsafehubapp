import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function promoteUserToFormationStageIfOnSpark(db: DbClient, userId: string) {
  const [formationStage, currentUser] = await Promise.all([
    db.pathStage.findFirst({
      where: { order: 2 },
      select: { id: true }
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        pathStageId: true,
        pathStage: {
          select: { order: true }
        }
      }
    })
  ]);

  if (!formationStage || !currentUser) return false;

  const currentOrder = currentUser.pathStage?.order ?? 1;
  if (currentOrder > 1) return false;
  if (currentUser.pathStageId === formationStage.id) return false;

  await db.user.update({
    where: { id: userId },
    data: { pathStageId: formationStage.id }
  });

  return true;
}
