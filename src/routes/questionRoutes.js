import express from "express";
import {
  createQuestion,
  getQuestionsBySurvey,
  updateQuestion,
  deleteQuestion,
  getQuestions,
  getAiGeneratedQuestions,
} from "../controllers/questionController.js";

import { protect } from "../middleware/authMiddleware.js";
import {
  createQuestionValidation,
  updateQuestionValidation,
} from "../validations/validationSchemas.js";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();
// router.use(protect);

router.post(
  "/",
  protect,
  validateRequest(createQuestionValidation),
  createQuestion
);
router.get("/survey/:surveyId", getQuestionsBySurvey);
router.get("/", getQuestions);
router.get("/:surveyId/", getAiGeneratedQuestions);
router.put(
  "/:id",
  protect,
  validateRequest(updateQuestionValidation),
  updateQuestion
);
router.delete("/:id", protect, deleteQuestion);

export default router;
