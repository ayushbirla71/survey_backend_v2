import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  shareSurveyValidation,
  testTokenValidation,
} from "../validations/validationSchemas.js";
import {
  createSurveyTestToken,
  shareSurvey,
  validateToken,
} from "../controllers/shareController.js";

const router = express.Router();

// Protected routes
// router.use(protect);

router.post("/", protect, validateRequest(shareSurveyValidation), shareSurvey);
router.post(
  "/test-token",
  validateRequest(testTokenValidation),
  createSurveyTestToken,
);
router.get("/validate/:token", validateToken);

export default router;
