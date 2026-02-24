import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function printUsage() {
  console.log("Usage: npm run demo:stage -- <stageOrder|stageName> [email]");
  console.log("Examples:");
  console.log("  npm run demo:stage -- 1");
  console.log("  npm run demo:stage -- 4 demo@artsafehub.app");
  console.log("  npm run demo:stage -- \"Наследие\"");
}

async function main() {
  const [stageInput, emailInput] = process.argv.slice(2);
  if (!stageInput) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const email = emailInput?.trim() || "demo@artsafehub.app";
  const parsedOrder = Number(stageInput);
  const isOrder = Number.isInteger(parsedOrder) && parsedOrder > 0;

  const stage = await prisma.pathStage.findFirst({
    where: isOrder
      ? { order: parsedOrder }
      : { name: { equals: stageInput.trim(), mode: "insensitive" } },
    orderBy: { order: "asc" }
  });

  if (!stage) {
    console.error(`Stage not found for input: ${stageInput}`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exitCode = 1;
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { pathStageId: stage.id },
    include: { pathStage: true }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: updatedUser.email,
        stageOrder: updatedUser.pathStage?.order,
        stageName: updatedUser.pathStage?.name,
        stageDescription: updatedUser.pathStage?.description
      },
      null,
      2
    )
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
