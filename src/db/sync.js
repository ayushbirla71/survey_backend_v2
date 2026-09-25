import sequelize from "./connectDB.js";
import * as models from "../models/index.js";
import dotenv from "dotenv";
dotenv.config();

const syncDb = async () => {
  try {
    await sequelize.authenticate();
    console.log("⚡ Database connection established successfully.");
    await sequelize.sync();
    await sequelize.query(
      `ALTER TABLE "Option" ADD COLUMN IF NOT EXISTS "nextQuestionId" VARCHAR(255);`
    );
    await sequelize.query(
      `ALTER TABLE "Option" ADD COLUMN IF NOT EXISTS "parentOptionId" VARCHAR(255);`
    );
    await sequelize.query(
      `ALTER TABLE "Option" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;`
    );
    await sequelize.query(
      `ALTER TABLE "Option" ADD COLUMN IF NOT EXISTS "option_id" VARCHAR(255);`
    );
    console.log("✅ All Sequelize models synchronized with database.");
  } catch (error) {
    console.error("❌ Error syncing database:", error);
    process.exit(1);
  }
};

syncDb();
