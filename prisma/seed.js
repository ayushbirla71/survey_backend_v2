import { PrismaClient } from "@prisma/client";
import { questionTypeMap, surveyCategories } from "./data.js";

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // ---- Question Categories ----
  const questionCategoriesData = Object.entries(questionTypeMap).map(
    ([type_name, id]) => ({
      id,
      type_name,
      settings: {}, // default empty JSON
    }),
  );

  await prisma.questionCategory.createMany({
    data: questionCategoriesData,
    skipDuplicates: true, // critical for re-runs
  });

  console.log("Question categories seeded successfully");

  // ---- Survey Categories ----
  const surveyCategoryData = surveyCategories.map(({ id, name }) => ({
    id,
    name,
  }));

  await prisma.surveyCategory.createMany({
    data: surveyCategoryData,
    skipDuplicates: true, // critical for re-runs
  });
  console.log("Survey categories seeded successfully");

  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
