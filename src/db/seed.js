import {
  adminUserDetails,
  questionTypeMap,
  surveyCategories,
  vendorAndConfig,
} from "../../prisma/data.js";
import bcrypt from "bcryptjs";
import sequelize, {
  QuestionCategory,
  SurveyCategory,
  User,
  Vendor,
  VendorApiConfig,
} from "../models/index.js";

async function seed() {
  console.log("Start seeding with Sequelize...");
  await sequelize.authenticate();

  // ---- Question Categories ----
  for (const [type_name, id] of Object.entries(questionTypeMap)) {
    let qc = await QuestionCategory.findByPk(id);
    if (!qc) {
      await QuestionCategory.create({ id, type_name, settings: {} });
    } else {
      await qc.update({ type_name });
    }
  }
  console.log("Question categories seeded successfully");

  // ---- Survey Categories ----
  for (const { id, name } of surveyCategories) {
    let sc = await SurveyCategory.findByPk(id);
    if (!sc) {
      await SurveyCategory.create({ id, name });
    } else {
      await sc.update({ name });
    }
  }
  console.log("Survey categories seeded successfully");

  // ------ Default Admin Users -------
  for (const user of adminUserDetails) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    let u = await User.findOne({ where: { email: user.email } });
    if (u) {
      await u.update({
        name: user.name,
        mobile_no: user.mobile_no,
        password: hashedPassword,
        role: "SYSTEM_ADMIN",
      });
    } else {
      await User.create({
        name: user.name,
        email: user.email,
        mobile_no: user.mobile_no,
        password: hashedPassword,
        role: "SYSTEM_ADMIN",
      });
    }
    console.log(`User seeded: ${user.email}`);
  }

  // ------ Vendor And its API Config -------
  for (const vendorItem of vendorAndConfig) {
    const { key, name, apiConfig } = vendorItem;
    let v = await Vendor.findOne({ where: { key } });
    if (v) {
      await v.update({ name, is_active: true });
    } else {
      v = await Vendor.create({ key, name, is_active: true });
    }
    console.log(`Vendor seeded: ${v.key}`);

    let config = await VendorApiConfig.findOne({
      where: { vendorId: v.id, api_version: apiConfig.api_version },
    });
    if (config) {
      await config.update({
        base_url: apiConfig.base_url,
        auth_type: apiConfig.auth_type,
        credentials: apiConfig.credentials,
        is_default: true,
        is_active: true,
      });
    } else {
      await VendorApiConfig.create({
        vendorId: v.id,
        api_version: apiConfig.api_version,
        base_url: apiConfig.base_url,
        auth_type: apiConfig.auth_type,
        credentials: apiConfig.credentials,
        is_default: true,
        is_active: true,
      });
    }
    console.log(`API config seeded for ${v.key} (${apiConfig.api_version})`);
  }

  console.log("Seeding finished.");
  await sequelize.close();
}

seed().catch((e) => {
  console.error("Seeding error:", e);
  process.exit(1);
});
