import express from "express";
import { innovateWebhook } from "../controllers/webhookController.js";

const router = express.Router();

router.get("/innovate/:surveyId", innovateWebhook);

export default router;
