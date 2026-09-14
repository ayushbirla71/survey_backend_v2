import sequelize from "./connectDB.js";
import * as models from "../models/index.js";
import dotenv from "dotenv";
dotenv.config();

const syncDb = async () => {
  try {
    await sequelize.authenticate();
    console.log("⚡ Database connection established successfully.");
    await sequelize.sync();
    console.log("✅ All Sequelize models synchronized with database.");
  } catch (error) {
    console.error("❌ Error syncing database:", error);
    process.exit(1);
  }
};

syncDb();
