import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createSurveyValidation,
  updateSurveyValidation,
} from "../validations/validationSchemas.js";
import {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  createSurvey_v2,
  updateSurvey_v2,
} from "../controllers/surveyController.js";

const router = express.Router();

// All routes protected with JWT
// router.use(protect);

router.post(
  "/",
  protect,
  validateRequest(createSurveyValidation),
  createSurvey_v2,
);
router.get("/", protect, getSurveys);
router.get("/:id", getSurveyById);
router.put(
  "/:id",
  protect,
  validateRequest(updateSurveyValidation),
  updateSurvey_v2,
);
router.delete("/:id", protect, deleteSurvey);

export default router;
