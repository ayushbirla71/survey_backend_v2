import express from "express";
import {
  innovateWebhook,
  survey96Webhook,
} from "../controllers/webhookController.js";

const router = express.Router();

router.get("/innovate/:surveyId", innovateWebhook);
router.get("/survey96/:surveyId", survey96Webhook);

export default router;
