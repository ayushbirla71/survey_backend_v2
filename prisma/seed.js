import { PrismaClient } from "@prisma/client";
import {
  adminUserDetails,
  questionTypeMap,
  surveyCategories,
  vendorAndConfig,
} from "./data.js";
import bcrypt from "bcryptjs";

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

  // ------ Default Admin Users -------
  for (const user of adminUserDetails) {
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        mobile_no: user.mobile_no,
        password: hashedPassword,
        role: "SYSTEM_ADMIN", // Explicitly set role
      },
      create: {
        name: user.name,
        email: user.email,
        mobile_no: user.mobile_no,
        password: hashedPassword,
        role: "SYSTEM_ADMIN",
      },
    });

    console.log(`User seeded: ${user.email}`);
  }

  // ------ Vendor And its API Config -------
  for (const vendorItem of vendorAndConfig) {
    const { key, name, apiConfig } = vendorItem;

    // 1️⃣ Upsert Vendor
    const vendor = await prisma.vendor.upsert({
      where: { key },
      update: {
        name,
        is_active: true,
      },
      create: {
        key,
        name,
        is_active: true,
      },
    });

    console.log(`Vendor seeded: ${vendor.key}`);

    // 2️⃣ Upsert Vendor API Config
    await prisma.vendorApiConfig.upsert({
      where: {
        vendorId_api_version: {
          vendorId: vendor.id,
          api_version: apiConfig.api_version,
        },
      },
      update: {
        base_url: apiConfig.base_url,
        auth_type: apiConfig.auth_type,
        credentials: apiConfig.credentials,
        is_default: true,
        is_active: true,
      },
      create: {
        vendorId: vendor.id,
        api_version: apiConfig.api_version,
        base_url: apiConfig.base_url,
        auth_type: apiConfig.auth_type,
        credentials: apiConfig.credentials,
        is_default: true,
        is_active: true,
      },
    });

    console.log(
      `API config seeded for ${vendor.key} (${apiConfig.api_version})`,
    );
  }

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
