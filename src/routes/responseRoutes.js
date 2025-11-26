import express from "express";
import {
  submitResponse,
  getResponsesBySurvey,
  submitResponseWithToken,
  getSurveyResults,
  getSurveyAnalytics,
  exportSurveyAnalytics,
} from "../controllers/responseController.js";
import { protect } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createResponseValidation,
  createResponseWithTokenValidation,
} from "../validations/validationSchemas.js";

const router = express.Router();
// router.use(protect);

// Token-based response submission
router.post(
  "/submit-token",
  validateRequest(createResponseWithTokenValidation),
  submitResponseWithToken
);
router.post("/", validateRequest(createResponseValidation), submitResponse);
// router.get("/surveys/:surveyId/results", protect, getSurveyResults);
router.get("/surveys/:surveyId/results", protect, getSurveyAnalytics);
router.get("/surveys/:surveyId/export", protect, exportSurveyAnalytics);
router.get("/survey/:surveyId", protect, getResponsesBySurvey);

export default router;
