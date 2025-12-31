import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import surveyRoutes from "./routes/surveyRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import aiQuestionRoutes from "./routes/aiQuestionRoutes.js";
import responseRoutes from "./routes/responseRoutes.js";
import shareRoutes from "./routes/shareRoutes.js";
import surveyResultsRoutes from "./routes/surveyResultsRoutes.js";
// import reportRoutes from "./routes/reportRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import categoriesRoutes from "./routes/categoriesRoutes.js";
import quotaRoutes from "./routes/quotaRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { swaggerSetup } from "./docs/swagger.js";
import { upload } from "./middleware/uploadMiddleware.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/ai-questions", aiQuestionRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/survey-results", surveyResultsRoutes);
// app.use("/api/reports", reportRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/quota", quotaRoutes);
app.use("/api/upload", upload.single("media"), uploadRoutes);

// VENDOR ROUTES
app.use("/api/vendors", vendorRoutes);

app.use("/api/webhook", webhookRoutes);

// SWAGGER DOCS
swaggerSetup(app);

export default app;
