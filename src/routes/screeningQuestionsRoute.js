import express from "express";
import {
  createScreeningQuestion,
  deleteScreeningQuestion,
  getScreeningQuestions,
  updateScreeningQuestion,
  updateScreeningQuestionsListFromVendorSide,
} from "../controllers/screeningQuestionsController.js";

const router = express.Router();

router.get("/", getScreeningQuestions);
router.get("/updated", updateScreeningQuestionsListFromVendorSide);
router.post("/", createScreeningQuestion);
router.patch("/:id", updateScreeningQuestion);
router.delete("/:id", deleteScreeningQuestion);

export default router;
