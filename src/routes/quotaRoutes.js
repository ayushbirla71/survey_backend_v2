import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  quotaConfigValidation,
  updateQuotaConfigValidation,
  checkRespondentValidation,
  markRespondentValidation,
  terminateRespondentValidation,
  getEstimatedAmountValidation,
  getExactAmountValidation,
} from "../validations/quotaValidation.js";
import {
  createQuotaConfig,
  getQuotaConfig,
  updateQuotaConfig,
  deleteQuotaConfig,
  getQuotaStatus,
  checkRespondentQuota,
  markRespondentCompleted,
  markRespondentTerminated,
  updateQuota_v2,
  getQuota_v2,
  getFullScreeningQuestionsBasedOnQuota,
  checkRespondentQuota_v2,
  markRespondentCompleted_v2,
  markRespondentTerminated_v2,
  getEstimatedAmount,
  getExactAmount,
} from "../controllers/quotaController.js";

const router = express.Router();

/**
 * @route   POST /api/quota/surveys/:surveyId/quota
 * @desc    Create quota configuration for a survey
 * @access  Private
 */
router.post(
  "/surveys/:surveyId/quota",
  protect,
  validateRequest(quotaConfigValidation),
  createQuotaConfig,
);

/**
 * @route   GET /api/quota/surveys/:surveyId/quota
 * @desc    Get quota configuration for a survey
 * @access  Private
 */
router.get("/surveys/:surveyId/quota", protect, getQuotaConfig);

/**
 * @route   PUT /api/quota/surveys/:surveyId/quota
 * @desc    Update quota configuration for a survey
 * @access  Private
 */
router.put(
  "/surveys/:surveyId/quota",
  protect,
  validateRequest(updateQuotaConfigValidation),
  updateQuotaConfig,
);

/**
 * @route   DELETE /api/quota/surveys/:surveyId/quota
 * @desc    Delete quota configuration for a survey
 * @access  Private
 */
router.delete("/surveys/:surveyId/quota", protect, deleteQuotaConfig);

/**
 * @route   GET /api/quota/surveys/:surveyId/status
 * @desc    Get quota status with fill rates
 * @access  Private
 */
router.get("/surveys/:surveyId/status", protect, getQuotaStatus);

// ============================================
// PUBLIC ROUTES (for vendor integration)
// ============================================

/**
 * @route   POST /api/quota/:surveyId/check
 * @desc    Check if respondent qualifies for quota
 * @access  Public (for vendor integration)
 */
router.post(
  "/:surveyId/check",
  validateRequest(checkRespondentValidation),
  checkRespondentQuota,
);

/**
 * @route   POST /api/quota/:surveyId/complete
 * @desc    Mark respondent as completed
 * @access  Public (for vendor integration)
 */
router.post(
  "/:surveyId/complete",
  validateRequest(markRespondentValidation),
  markRespondentCompleted,
);

/**
 * @route   POST /api/quota/:surveyId/terminate
 * @desc    Mark respondent as terminated
 * @access  Public (for vendor integration)
 */
router.post(
  "/:surveyId/terminate",
  validateRequest(terminateRespondentValidation),
  markRespondentTerminated,
);

router.post(
  "/:surveyId/quota_v2",
  protect,
  // validateRequest(quotaConfigValidation),
  updateQuota_v2,
);

router.get(
  "/:surveyId/quota_v2",
  //  protect,
  getQuota_v2,
);

router.get(
  "/:surveyId/quota-screening-questions",
  //  protect,
  getFullScreeningQuestionsBasedOnQuota,
);

router.post(
  "/:surveyId/check_v2",
  // validateRequest(checkRespondentValidation),
  checkRespondentQuota_v2,
);

router.post(
  "/:surveyId/complete_v2",
  validateRequest(markRespondentValidation),
  markRespondentCompleted_v2,
);

router.post("/terminate_v2", markRespondentTerminated_v2);

router.post(
  "/getEstimatedAmount",
  validateRequest(getEstimatedAmountValidation),
  getEstimatedAmount,
);

router.post(
  "/getExactAmount",
  validateRequest(getExactAmountValidation),
  getExactAmount,
);

export default router;
