import axios from "axios";
import sequelize, {
  Survey,
  SurveyQuota,
  SurveyQuotaOption,
  SurveyQuotaBucket,
  QuotaRespondent,
  ScreeningQuestionDefinition,
  ScreenQuestionOption,
  ShareToken,
  Vendor,
  VendorApiConfig,
  SurveyVendorConfig,
} from "../models/index.js";
import { Op } from "sequelize";
import {
  validateQuotaConfiguration,
  processCallbackUrl,
  callVendorCallback,
  formatQuotaStatus,
  mapScreeningQuestionType,
  formatScreeningQuestionsForResponse,
} from "../utils/quotaUtils.js";
import {
  buildQuotaConditions,
  validateInnovateMRResponse,
} from "../utils/vendorUtils.js";
import { pushSurveyToVendor } from "../services/vendorSurveyService.js";
import { fetchGroupFeasibilityFromVendor } from "../services/vendorExactFeasibilityService.js";
import { getRedirectUrlFromVendor } from "../services/vendorRedirectUrlService.js";

/**
 * @desc Create quota configuration for a survey
 * @route POST /api/quota/surveys/:surveyId/quota
 * @access Private
 */
export const createQuotaConfig = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      total_target,
      completed_url,
      terminated_url,
      quota_full_url,
      age_quotas,
      gender_quotas,
      location_quotas,
      category_quotas,
      screening_questions,
    } = req.body;

    const survey = await Survey.findOne({
      where: { id: surveyId, userId: req.user.id },
    });

    if (!survey) {
      return res
        .status(404)
        .json({ message: "Survey not found or access denied" });
    }

    const existingQuota = await SurveyQuota.findOne({
      where: { surveyId },
    });

    if (existingQuota) {
      return res.status(400).json({
        message: "Quota configuration already exists for this survey",
      });
    }

    const validation = validateQuotaConfiguration({
      total_target,
      age_quotas,
      gender_quotas,
      location_quotas,
      category_quotas,
    });

    if (!validation.isValid) {
      return res.status(400).json({
        message: "Quota validation failed",
        errors: validation.errors,
      });
    }

    const quota = await sequelize.transaction(async (t) => {
      const surveyQuota = await SurveyQuota.create(
        {
          surveyId,
          target_count: total_target,
        },
        { transaction: t }
      );

      return surveyQuota;
    });

    const completeQuota = await SurveyQuota.findByPk(quota.id, {
      include: [
        {
          model: SurveyQuotaOption,
          as: "quota_options",
          include: [
            { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
            { model: ScreenQuestionOption, as: "screeningOption" },
          ],
        },
        {
          model: SurveyQuotaBucket,
          as: "quota_buckets",
          include: [{ model: ScreeningQuestionDefinition, as: "screeningQuestion" }],
        },
      ],
    });

    res.status(201).json({
      message: "Quota configuration created successfully",
      quota: completeQuota,
    });
  } catch (error) {
    console.error("Create quota error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Get quota configuration for a survey
 * @route GET /api/quota/surveys/:surveyId/quota
 * @access Private
 */
export const getQuotaConfig = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const quota = await SurveyQuota.findOne({
      where: { surveyId },
      include: [
        {
          model: SurveyQuotaOption,
          as: "quota_options",
          include: [
            { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
            { model: ScreenQuestionOption, as: "screeningOption" },
          ],
        },
        {
          model: SurveyQuotaBucket,
          as: "quota_buckets",
          include: [{ model: ScreeningQuestionDefinition, as: "screeningQuestion" }],
        },
      ],
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    res.json(quota);
  } catch (error) {
    console.error("Get quota error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Update quota configuration
 * @route PUT /api/quota/surveys/:surveyId/quota
 * @access Private
 */
export const updateQuotaConfig = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { total_target, is_active } = req.body;

    const survey = await Survey.findOne({
      where: { id: surveyId, userId: req.user.id },
    });

    if (!survey) {
      return res
        .status(404)
        .json({ message: "Survey not found or access denied" });
    }

    const existingQuota = await SurveyQuota.findOne({
      where: { surveyId },
    });

    if (!existingQuota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    await SurveyQuota.update(
      {
        target_count: total_target ?? existingQuota.target_count,
        is_active: is_active ?? existingQuota.is_active,
      },
      { where: { id: existingQuota.id } }
    );

    const updatedQuota = await SurveyQuota.findByPk(existingQuota.id);

    res.json({
      message: "Quota configuration updated successfully",
      quota: updatedQuota,
    });
  } catch (error) {
    console.error("Update quota error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Delete quota configuration
 * @route DELETE /api/quota/surveys/:surveyId/quota
 * @access Private
 */
export const deleteQuotaConfig = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const survey = await Survey.findOne({
      where: { id: surveyId, userId: req.user.id },
    });

    if (!survey) {
      return res
        .status(404)
        .json({ message: "Survey not found or access denied" });
    }

    const quota = await SurveyQuota.findOne({
      where: { surveyId },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    await SurveyQuota.destroy({ where: { id: quota.id } });

    res.json({ message: "Quota configuration deleted successfully" });
  } catch (error) {
    console.error("Delete quota error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Get quota status with fill rates
 * @route GET /api/quota/surveys/:surveyId/status
 * @access Private
 */
export const getQuotaStatus = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const quota = await SurveyQuota.findOne({
      where: { surveyId },
      include: [
        {
          model: SurveyQuotaOption,
          as: "quota_options",
          include: [
            { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
            { model: ScreenQuestionOption, as: "screeningOption" },
          ],
        },
        {
          model: SurveyQuotaBucket,
          as: "quota_buckets",
          include: [{ model: ScreeningQuestionDefinition, as: "screeningQuestion" }],
        },
      ],
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    const status = {
      survey_id: surveyId,
      total_target: quota.target_count,
      current_count: quota.current_count,
      qualified_count: quota.qualified_count,
      terminated_count: quota.terminated_count,
      quota_full_count: quota.quota_full_count,
      overall_progress:
        quota.target_count > 0
          ? Math.round((quota.current_count / quota.target_count) * 100 * 100) / 100
          : 0,
      is_active: quota.is_active,
    };

    res.json({ status });
  } catch (error) {
    console.error("Get quota status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Check if respondent qualifies for quota
 * @route POST /api/quota/:surveyId/check
 * @access Public (for vendor integration)
 */
export const checkRespondentQuota = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      vendor_respondent_id,
      age,
      gender,
      country,
      state,
      city,
      surveyCategoryId,
    } = req.body;

    const quota = await SurveyQuota.findOne({
      where: { surveyId },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    const respondentData = {
      surveyQuotaId: quota.id,
      vendor_respondent_id,
      age,
      gender,
      country,
      state,
      city,
      surveyCategoryId,
    };

    const saveAndRespond = async (status, message, quotaType = null) => {
      const isQuotaFull = status === "QUOTA_FULL";
      const isTerminated = status === "TERMINATED";

      const respondent = await sequelize.transaction(async (t) => {
        const newRespondent = await QuotaRespondent.create(
          { ...respondentData, status },
          { transaction: t }
        );

        if (isQuotaFull) {
          await SurveyQuota.increment("quota_full_count", {
            by: 1,
            where: { id: quota.id },
            transaction: t,
          });
        } else if (isTerminated) {
          await SurveyQuota.increment("terminated_count", {
            by: 1,
            where: { id: quota.id },
            transaction: t,
          });
        }

        return newRespondent;
      });

      return res.status(200).json({
        qualified: false,
        status,
        message,
        respondent_id: respondent.id,
        quota_type: quotaType,
      });
    };

    if (!quota.is_active) {
      return saveAndRespond("QUOTA_FULL", "Survey quota is not active");
    }

    if (quota.target_count && quota.current_count >= quota.target_count) {
      return saveAndRespond("QUOTA_FULL", "Total survey quota is full");
    }

    const respondent = await QuotaRespondent.create({
      ...respondentData,
      status: "QUALIFIED",
    });

    return res.status(200).json({
      qualified: true,
      status: "QUALIFIED",
      message: "Respondent qualifies for survey",
      respondent_id: respondent.id,
      survey_id: surveyId,
    });
  } catch (error) {
    console.error("Check respondent quota error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Mark respondent as completed
 * @route POST /api/quota/:surveyId/complete
 * @access Public
 */
export const markRespondentCompleted = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { respondent_id, response_id } = req.body;

    const respondent = await QuotaRespondent.findByPk(respondent_id, {
      include: [{ model: SurveyQuota, as: "surveyQuota" }],
    });

    if (!respondent) {
      return res.status(404).json({ message: "Respondent not found" });
    }

    if (respondent.surveyQuota.surveyId !== surveyId) {
      return res
        .status(400)
        .json({ message: "Respondent does not belong to this survey" });
    }

    if (respondent.status === "COMPLETED") {
      return res
        .status(400)
        .json({ message: "Respondent already marked as completed" });
    }

    const result = await sequelize.transaction(async (t) => {
      await QuotaRespondent.update(
        {
          status: "COMPLETED",
          responseId: response_id,
        },
        { where: { id: respondent_id }, transaction: t }
      );

      await SurveyQuota.increment("current_count", {
        by: 1,
        where: { id: respondent.surveyQuotaId },
        transaction: t,
      });

      return await QuotaRespondent.findByPk(respondent_id, { transaction: t });
    });

    res.json({
      message: "Respondent marked as completed",
      respondent: result,
    });
  } catch (error) {
    console.error("Mark completed error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Mark respondent as terminated
 * @route POST /api/quota/:surveyId/terminate
 * @access Public
 */
export const markRespondentTerminated = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { respondent_id, reason } = req.body;

    const respondent = await QuotaRespondent.findByPk(respondent_id, {
      include: [{ model: SurveyQuota, as: "surveyQuota" }],
    });

    if (!respondent) {
      return res.status(404).json({ message: "Respondent not found" });
    }

    if (respondent.surveyQuota.surveyId !== surveyId) {
      return res
        .status(400)
        .json({ message: "Respondent does not belong to this survey" });
    }

    if (respondent.status === "TERMINATED") {
      return res
        .status(400)
        .json({ message: "Respondent already marked as terminated" });
    }

    const result = await sequelize.transaction(async (t) => {
      await QuotaRespondent.update(
        { status: "TERMINATED" },
        { where: { id: respondent_id }, transaction: t }
      );

      await SurveyQuota.increment("terminated_count", {
        by: 1,
        where: { id: respondent.surveyQuotaId },
        transaction: t,
      });

      return await QuotaRespondent.findByPk(respondent_id, { transaction: t });
    });

    res.json({
      message: "Respondent marked as terminated",
      respondent: result,
      reason,
    });
  } catch (error) {
    console.error("Mark terminated error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//  *******************   QUOTA V2   ******************************

const findRemovedTargetsFunction = async (surveyId, screening) => {
  try {
    const surveyQuotaModel = await SurveyQuota.findOne({
      where: { surveyId },
      include: [
        {
          model: SurveyQuotaOption,
          as: "quota_options",
          include: [
            { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
            { model: ScreenQuestionOption, as: "screeningOption" },
          ],
        },
        {
          model: SurveyQuotaBucket,
          as: "quota_buckets",
          include: [{ model: ScreeningQuestionDefinition, as: "screeningQuestion" }],
        },
      ],
    });

    if (!surveyQuotaModel) return [];
    const surveyQuota = surveyQuotaModel.toJSON();

    const screeningQuestions = await getScreeningQuestionsFromQuota(surveyQuota);

    const screeningSet = new Set(
      screening.map((item) => `${item.questionId}-${item.vendorQuestionId}`)
    );

    const filtered = screeningQuestions.filter(
      (item) =>
        !screeningSet.has(`${item.questionId}-${item.vendorQuestionId}`)
    );

    return filtered;
  } catch (error) {
    console.log("Error in findRemovedTargetsFunction: ", error);
    return [];
  }
};

export const updateQuota_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const {
      enabled,
      totalTarget,
      screening,
      vendorId,
      countryCode,
      language,
      incidenceRate,
      lengthOfInterview,
    } = req.body;

    const filteredScreening = (screening || []).map((q) => ({
      questionId: q.questionId,
      vendorQuestionId: q.vendorQuestionId,
      optionTargets: (q.optionTargets ?? []).filter((o) => o.target > 0),
      buckets: (q.buckets ?? []).filter((b) => b.target > 0),
    }));

    const survey = await Survey.findByPk(surveyId);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    let deleteVendorTargets = null;
    if (survey.survey_send_by === "VENDOR") {
      deleteVendorTargets = await findRemovedTargetsFunction(
        surveyId,
        filteredScreening
      );
    }

    await sequelize.transaction(async (t) => {
      let quota = await SurveyQuota.findOne({
        where: { surveyId },
        transaction: t,
      });

      const updateData = {
        target_count: totalTarget,
        is_active: enabled,
        country_code: countryCode,
        language,
        ...(vendorId && { vendorId }),
      };

      if (quota) {
        await SurveyQuota.update(updateData, {
          where: { id: quota.id },
          transaction: t,
        });
      } else {
        quota = await SurveyQuota.create(
          {
            surveyId,
            current_count: 0,
            ...updateData,
          },
          { transaction: t }
        );
      }

      await SurveyQuotaOption.destroy({
        where: { quotaId: quota.id },
        transaction: t,
      });
      await SurveyQuotaBucket.destroy({
        where: { quotaId: quota.id },
        transaction: t,
      });

      for (const q of filteredScreening) {
        for (const opt of q.optionTargets) {
          if (opt.target <= 0) continue;

          await SurveyQuotaOption.create(
            {
              quotaId: quota.id,
              screeningQuestionId: q.questionId,
              screeningOptionId: opt.optionId,
              target_count: opt.target,
              current_count: 0,
            },
            { transaction: t }
          );
        }

        for (const b of q.buckets) {
          await SurveyQuotaBucket.create(
            {
              quotaId: quota.id,
              screeningQuestionId: q.questionId,
              label: b.label ?? null,
              operator: b.operator,
              value: b.value,
              target_count: b.target,
              current_count: 0,
              is_active: true,
            },
            { transaction: t }
          );
        }
      }
    });

    if (survey.survey_send_by === "VENDOR") {
      await pushSurveyToVendor({
        survey,
        vendorId,
        totalTarget,
        incidenceRate,
        lengthOfInterview,
        screening: filteredScreening,
        deleteVendorTargets,
      });
    }

    return res.json({ message: "Quota updated" });
  } catch (error) {
    console.error("Update Quota Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getScreeningQuestionsFromQuota = async (quota) => {
  try {
    const questionMap = new Map();

    (quota.quota_options || []).forEach((option) => {
      const questionId = option.screeningQuestionId;

      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          questionId,
          vendorQuestionId:
            option?.screeningQuestion?.vendor_question_id || null,
          id: questionId,
          optionTargets: [],
          buckets: [],
          questionKey: option?.screeningQuestion?.question_key || null,
        });
      }

      questionMap.get(questionId).optionTargets.push({
        optionId: option.screeningOptionId,
        option_id: option.screeningOptionId,
        target: option.target_count,
        current: option.current_count,
        vendorOptionId: option?.screeningOption?.vendor_option_id || null,
      });
    });

    (quota.quota_buckets || []).forEach((b) => {
      const questionId = b.screeningQuestionId;

      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          questionId,
          vendorQuestionId: b?.screeningQuestion?.vendor_question_id || null,
          id: questionId,
          optionTargets: [],
          buckets: [],
          questionKey: b?.screeningQuestion?.question_key || null,
        });
      }

      questionMap.get(questionId).buckets.push({
        bucketId: b.id,
        id: b.id,
        label: b.label,
        operator: b.operator,
        value: b.value,
        target: b.target_count,
        current: b.current_count,
        is_active: b.is_active,
      });
    });

    return Array.from(questionMap.values());
  } catch (error) {
    console.log("Error in getScreeningQuestionsFromQuota: ", error);
    throw new Error("Failed to get Screening Question for quota.");
  }
};

export const getQuota_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const survey = await Survey.findByPk(surveyId);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const quotaModel = await SurveyQuota.findOne({
      where: { surveyId },
      include: [
        {
          model: SurveyQuotaOption,
          as: "quota_options",
          include: [
            { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
            { model: ScreenQuestionOption, as: "screeningOption" },
          ],
        },
        {
          model: SurveyQuotaBucket,
          as: "quota_buckets",
          include: [{ model: ScreeningQuestionDefinition, as: "screeningQuestion" }],
        },
      ],
    });

    if (!quotaModel) return res.status(404).json({ message: "Quota not found" });
    const quota = quotaModel.toJSON();

    const screeningquestions = await getScreeningQuestionsFromQuota(quota);

    let exactPrice = null;
    if (survey.survey_send_by === "VENDOR") {
      const surveyVendorConfigDetails = await SurveyVendorConfig.findOne({
        where: { surveyId },
      });
      if (surveyVendorConfigDetails)
        exactPrice = surveyVendorConfigDetails.quota_cost;
    }

    const formattedQuota = {
      id: quota.id,
      surveyId: quota.surveyId,
      totaltarget: quota.target_count,
      country_code: quota.country_code,
      language: quota.language,
      vendorId: quota.vendorId,
      screeningquestions,
    };
    if (exactPrice) formattedQuota.exactPrice = exactPrice;

    return res.json(formattedQuota);
  } catch (error) {
    console.error("Get Quota Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const getFullScreeningQuestionsBasedOnQuota = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const survey = await Survey.findByPk(surveyId);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const quotaModel = await SurveyQuota.findOne({
      where: { surveyId },
      include: [
        { model: SurveyQuotaOption, as: "quota_options" },
        { model: SurveyQuotaBucket, as: "quota_buckets" },
      ],
    });

    if (!quotaModel) return res.status(404).json({ message: "Quota not found" });
    const quota = quotaModel.toJSON();

    const questionIds = Array.from(
      new Set([
        ...(quota.quota_options || []).map((o) => o.screeningQuestionId),
        ...(quota.quota_buckets || []).map((b) => b.screeningQuestionId),
      ])
    );

    const questions = await ScreeningQuestionDefinition.findAll({
      where: { id: { [Op.in]: questionIds } },
      attributes: [
        "id",
        "question_text",
        "question_type",
        "vendor_question_id",
        "data_type",
      ],
      include: [
        {
          model: ScreenQuestionOption,
          as: "options",
          attributes: ["id", "option_text", "vendor_option_id", "order_index"],
        },
      ],
    });

    return res.json({
      message: "Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("Get Full Screening Questions Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

async function failRespondent(quotaId, vendorId, status, full = false) {
  return sequelize.transaction(async (t) => {
    const r = await QuotaRespondent.create(
      { surveyQuotaId: quotaId, vendor_respondent_id: vendorId, status },
      { transaction: t }
    );

    if (full) {
      await SurveyQuota.increment("quota_full_count", {
        by: 1,
        where: { id: quotaId },
        transaction: t,
      });
    } else {
      await SurveyQuota.increment("terminated_count", {
        by: 1,
        where: { id: quotaId },
        transaction: t,
      });
    }

    return r;
  });
}

function matchBucket(bucket, answerValue) {
  const op = bucket.operator;
  const v = bucket.value;

  if (op === "BETWEEN")
    return Number(answerValue) >= v.min && Number(answerValue) <= v.max;
  if (op === "IN") return Array.isArray(v) && v.includes(String(answerValue));
  if (op === "EQUALS") return String(answerValue) === String(v);
  if (op === "GREATER_THAN") return Number(answerValue) >= Number(v);
  if (op === "LESS_THAN") return Number(answerValue) <= Number(v);
  if (op === "INTERSECTS") {
    if (!Array.isArray(answerValue) || !Array.isArray(v)) return false;
    const set = new Set(answerValue.map(String));
    return v.map(String).some((x) => set.has(x));
  }
  return false;
}

export const checkRespondentQuota_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const { vendor_respondent_id, screeningAnswers, shareToken } = req.body;

    const shareTokenDetails = await ShareToken.findOne({
      where: { token_hash: shareToken },
    });

    const quotaModel = await SurveyQuota.findOne({
      where: { surveyId },
      include: [
        { model: SurveyQuotaOption, as: "quota_options" },
        { model: SurveyQuotaBucket, as: "quota_buckets" },
        { model: Survey, as: "survey" },
      ],
    });

    if (!quotaModel || !quotaModel.survey) {
      return res.status(404).json({
        qualified: false,
        status: "QUOTA_OR_SURVEY_NOT_FOUND",
        message: "Quota or Survey not found",
      });
    }

    const quota = quotaModel.toJSON();

    if (!quota.is_active || quota.target_count <= 0) {
      if (shareTokenDetails?.isTest === true) {
        return res.status(200).json({
          qualified: false,
          status: "QUOTA_INACTIVE",
          message: "Quota is not active",
          respondent_id: null,
        });
      }
      const respondent = await failRespondent(
        quota.id,
        vendor_respondent_id,
        "TERMINATED"
      );

      const response = {
        qualified: false,
        status: "QUOTA_INACTIVE",
        message: "Quota is not active",
        respondent_id: respondent.id,
      };

      if (quota.survey.survey_send_by === "VENDOR") {
        response.redirect_url = await redirectVendorFunction(
          quota.vendorId,
          shareTokenDetails,
          "TERMINATED"
        );
      }

      return res.status(200).json(response);
    }

    if (quota.current_count >= quota.target_count) {
      if (shareTokenDetails?.isTest === true) {
        return res.status(200).json({
          qualified: false,
          status: "QUOTA_FULL",
          message: "Quota is full",
          respondent_id: null,
        });
      }

      const respondent = await failRespondent(
        quota.id,
        vendor_respondent_id,
        "QUOTA_FULL",
        true
      );

      const response = {
        qualified: false,
        status: "QUOTA_FULL",
        message: "Quota is full",
        respondent_id: respondent.id,
      };

      if (quota.survey.survey_send_by === "VENDOR") {
        response.redirect_url = await redirectVendorFunction(
          quota.vendorId,
          shareTokenDetails,
          "QUOTA_FULL"
        );
      }

      return res.status(200).json(response);
    }

    const quotaOptionMap = new Map(
      (quota.quota_options || []).map((o) => [
        `${o.screeningQuestionId}_${o.screeningOptionId}`,
        o,
      ])
    );

    const bucketsByQuestion = new Map();
    for (const b of quota.quota_buckets || []) {
      if (!bucketsByQuestion.has(b.screeningQuestionId))
        bucketsByQuestion.set(b.screeningQuestionId, []);
      bucketsByQuestion.get(b.screeningQuestionId).push(b);
    }

    const normalizedAnswers = [];

    for (const ans of screeningAnswers || []) {
      if (ans.screeningOptionId) {
        const key = `${ans.screeningQuestionId}_${ans.screeningOptionId}`;
        const qOpt = quotaOptionMap.get(key);

        if (!qOpt) {
          if (shareTokenDetails?.isTest === true) {
            return res.status(200).json({
              qualified: false,
              status: "OPTION_NOT_ALLOWED",
              message: "Screening disqualified",
              respondent_id: null,
            });
          }

          const respondent = await failRespondent(
            quota.id,
            vendor_respondent_id,
            "TERMINATED"
          );

          const response = {
            qualified: false,
            status: "OPTION_NOT_ALLOWED",
            message: "Screening disqualified",
            respondent_id: respondent.id,
          };

          if (quota.survey.survey_send_by === "VENDOR") {
            response.redirect_url = await redirectVendorFunction(
              quota.vendorId,
              shareTokenDetails,
              "TERMINATED"
            );
          }

          return res.status(200).json(response);
        }

        if (qOpt.current_count >= qOpt.target_count) {
          if (shareTokenDetails?.isTest === true) {
            return res.status(200).json({
              qualified: false,
              status: "QUOTA_FULL",
              message: "Option quota full",
              respondent_id: null,
            });
          }

          const respondent = await failRespondent(
            quota.id,
            vendor_respondent_id,
            "QUOTA_FULL",
            true
          );

          const response = {
            qualified: false,
            status: "QUOTA_FULL",
            message: "Option quota full",
            respondent_id: respondent.id,
          };

          if (quota.survey.survey_send_by === "VENDOR") {
            response.redirect_url = await redirectVendorFunction(
              quota.vendorId,
              shareTokenDetails,
              "QUOTA_FULL"
            );
          }

          return res.status(200).json(response);
        }

        normalizedAnswers.push(ans);
        continue;
      }

      const buckets = bucketsByQuestion.get(ans.screeningQuestionId) ?? [];
      const matched = buckets.find((b) => matchBucket(b, ans.answerValue));

      if (!matched) {
        if (shareTokenDetails?.isTest === true) {
          return res.status(200).json({
            qualified: false,
            status: "NO_BUCKET_MATCH",
            message: "Screening disqualified",
            respondent_id: null,
          });
        }

        const respondent = await failRespondent(
          quota.id,
          vendor_respondent_id,
          "TERMINATED"
        );

        const response = {
          qualified: false,
          status: "NO_BUCKET_MATCH",
          message: "Screening disqualified",
          respondent_id: respondent.id,
        };

        if (quota.survey.survey_send_by === "VENDOR") {
          response.redirect_url = await redirectVendorFunction(
            quota.vendorId,
            shareTokenDetails,
            "TERMINATED"
          );
        }

        return res.status(200).json(response);
      }

      if (matched.current_count >= matched.target_count) {
        if (shareTokenDetails?.isTest === true) {
          return res.status(200).json({
            qualified: false,
            status: "QUOTA_FULL",
            message: "Open-ended bucket full",
            respondent_id: null,
          });
        }

        const respondent = await failRespondent(
          quota.id,
          vendor_respondent_id,
          "QUOTA_FULL",
          true
        );

        const response = {
          qualified: false,
          status: "QUOTA_FULL",
          message: "Open-ended bucket full",
          respondent_id: respondent.id,
        };

        if (quota.survey.survey_send_by === "VENDOR") {
          response.redirect_url = await redirectVendorFunction(
            quota.vendorId,
            shareTokenDetails,
            "QUOTA_FULL"
          );
        }

        return res.status(200).json(response);
      }

      normalizedAnswers.push({ ...ans, matchedBucketId: matched.id });
    }

    let respondent = null;
    if (!shareTokenDetails?.isTest) {
      respondent = await sequelize.transaction(async (t) => {
        const r = await QuotaRespondent.create(
          {
            surveyQuotaId: quota.id,
            vendor_respondent_id,
            answers: normalizedAnswers,
            status: "QUALIFIED",
          },
          { transaction: t }
        );

        await SurveyQuota.increment("qualified_count", {
          by: 1,
          where: { id: quota.id },
          transaction: t,
        });

        return r;
      });
    }

    return res.status(200).json({
      qualified: true,
      status: "QUALIFIED",
      message: "Qualified",
      respondent_id: respondent?.id || null,
    });
  } catch (error) {
    console.error("Check Respondent Quota Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const redirectVendorFunction = async (vendor_id, shareTokenDetails, type) => {
  try {
    const vendor_token =
      shareTokenDetails.vendor_respondent_id.split("_BR_")[0];

    const redirectUrl = await getRedirectUrlFromVendor({
      vendorId: vendor_id,
      vendor_token,
      type,
    });

    return redirectUrl;
  } catch (error) {
    console.log("Error in redirectVendorFunction: ", error);
    return error;
  }
};

export const markRespondentCompleted_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { respondent_id, response_id, token } = req.body;

    const respondentModel = await QuotaRespondent.findByPk(respondent_id, {
      include: [{ model: SurveyQuota, as: "surveyQuota" }],
    });

    if (!respondentModel) {
      return res.status(404).json({ message: "Respondent not found" });
    }
    const respondent = respondentModel.toJSON();

    if (respondent.surveyQuota.surveyId !== surveyId) {
      return res
        .status(400)
        .json({ message: "Respondent does not belong to this survey" });
    }

    if (respondent.status === "COMPLETED") {
      return res
        .status(400)
        .json({ message: "Respondent already marked as completed" });
    }

    const answers = Array.isArray(respondent.answers) ? respondent.answers : [];

    const optionPairs = answers
      .filter((a) => a.screeningQuestionId && a.screeningOptionId)
      .map((a) => ({
        screeningQuestionId: a.screeningQuestionId,
        screeningOptionId: a.screeningOptionId,
      }));

    const bucketIds = answers.map((a) => a.matchedBucketId).filter(Boolean);

    const result = await sequelize.transaction(async (t) => {
      await QuotaRespondent.update(
        {
          status: "COMPLETED",
          responseId: response_id,
        },
        { where: { id: respondent_id }, transaction: t }
      );

      await SurveyQuota.increment("current_count", {
        by: 1,
        where: { id: respondent.surveyQuotaId },
        transaction: t,
      });

      for (const pair of optionPairs) {
        await SurveyQuotaOption.increment("current_count", {
          by: 1,
          where: {
            quotaId: respondent.surveyQuotaId,
            screeningQuestionId: pair.screeningQuestionId,
            screeningOptionId: pair.screeningOptionId,
          },
          transaction: t,
        });
      }

      if (bucketIds.length) {
        await SurveyQuotaBucket.increment("current_count", {
          by: 1,
          where: {
            quotaId: respondent.surveyQuotaId,
            id: { [Op.in]: bucketIds },
          },
          transaction: t,
        });
      }

      return await QuotaRespondent.findByPk(respondent_id, { transaction: t });
    });

    const shareTokenDetails = await ShareToken.findOne({
      where: { token_hash: token, isTest: false },
      include: [{ model: Survey, as: "survey" }],
    });

    if (!shareTokenDetails) {
      return res.status(404).json({ message: "Invalid Share Token" });
    }

    const responsePayload = {
      message: "Respondent marked as completed",
    };
    if (shareTokenDetails.survey.survey_send_by === "VENDOR") {
      responsePayload.redirect_url = await redirectVendorFunction(
        respondent.surveyQuota?.vendorId,
        shareTokenDetails,
        "COMPLETED"
      );
    }
    responsePayload.respondent = result;

    return res.json(responsePayload);
  } catch (error) {
    console.error("Mark completed error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const markRespondentTerminated_v2 = async (req, res) => {
  try {
    const { shareToken, respondent_id } = req.query;

    const shareTokenDetails = await ShareToken.findOne({
      where: { token_hash: shareToken, isTest: false },
      include: [{ model: Survey, as: "survey" }],
    });

    if (!shareTokenDetails)
      return res.status(404).json({ message: "Invalid Share Token" });

    const respondentModel = await QuotaRespondent.findByPk(respondent_id, {
      include: [{ model: SurveyQuota, as: "surveyQuota" }],
    });

    if (!respondentModel)
      return res.status(404).json({ message: "Respondent not found" });
    const respondent = respondentModel.toJSON();

    if (respondent.surveyQuota.surveyId !== shareTokenDetails.surveyId) {
      return res
        .status(400)
        .json({ message: "Respondent does not belong to this survey" });
    }
    if (respondent.status === "TERMINATED") {
      return res
        .status(400)
        .json({ message: "Respondent already marked as terminated" });
    }

    const result = await sequelize.transaction(async (t) => {
      await QuotaRespondent.update(
        { status: "TERMINATED" },
        { where: { id: respondent_id }, transaction: t }
      );

      await SurveyQuota.increment("terminated_count", {
        by: 1,
        where: { id: respondent.surveyQuotaId },
        transaction: t,
      });

      return await QuotaRespondent.findByPk(respondent_id, { transaction: t });
    });

    if (shareTokenDetails.survey.survey_send_by === "VENDOR") {
      const redirectUrl = await redirectVendorFunction(
        respondent.surveyQuota?.vendorId,
        shareTokenDetails,
        "TERMINATED"
      );

      return res.redirect(302, redirectUrl);
    }

    return res.json({
      message: "Respondent marked as terminated",
      respondent: result,
    });
  } catch (error) {
    console.error("Mark terminated error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const getEstimatedAmount = async (req, res) => {
  try {
    const {
      vendorId,
      countryCode,
      language,
      totalTarget,
      incidenceRate,
      lengthOfSurvey,
      numberOfDays,
    } = req.body;

    const vendorDetailsModel = await Vendor.findByPk(vendorId, {
      include: [
        {
          model: VendorApiConfig,
          as: "api_configs",
          where: { is_default: true, is_active: true },
        },
      ],
    });

    if (!vendorDetailsModel) {
      throw new Error("Vendor not found");
    }
    const vendorDetails = vendorDetailsModel.toJSON();
    if (!vendorDetails.api_configs || vendorDetails.api_configs.length === 0) {
      throw new Error("No active API config found");
    }

    const apiConfig =
      vendorDetails.api_configs[vendorDetails.api_configs.length - 1];
    const { base_url, credentials } = apiConfig;

    const findEstimateResponse = await axios.post(
      `${base_url}/pega/feasibility`,
      {
        Country: "India",
        DaysInField: numberOfDays,
        IncidenceRate: incidenceRate,
        N: totalTarget,
        LengthOfInterview: lengthOfSurvey,
        Languages: language,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      }
    );

    const estimatedPrice =
      findEstimateResponse?.data?.feasibility?.commonFeas?.find(
        (feas) => feas.days == numberOfDays
      )?.estimate;

    return res.status(200).send({
      message: "Estimated amount fetched successfully.",
      data: { estimatedAmount: estimatedPrice },
    });
  } catch (error) {
    console.log("Error in getEstimatedAmount: ", error);
    return res
      .status(500)
      .send({ message: "Server error", error: error.message });
  }
};

export const getExactAmount = async (req, res) => {
  try {
    const { surveyId, vendorId } = req.body;

    const vendorDetailsModel = await Vendor.findByPk(vendorId, {
      include: [
        {
          model: VendorApiConfig,
          as: "api_configs",
          where: { is_default: true, is_active: true },
        },
      ],
    });

    if (!vendorDetailsModel) {
      throw new Error("Vendor not found");
    }
    const vendorDetails = vendorDetailsModel.toJSON();
    if (!vendorDetails.api_configs || vendorDetails.api_configs.length === 0) {
      throw new Error("No active API config found");
    }

    const surveyVendorConfigDetails = await SurveyVendorConfig.findOne({
      where: { surveyId, vendorId },
    });

    if (!surveyVendorConfigDetails)
      throw new Error(
        "Survey vendor config details not found for this survey."
      );
    const vendorGroupId = surveyVendorConfigDetails.vendor_group_id;

    if (!vendorGroupId)
      throw new Error("Group does not exist for this survey.");

    const getGroupFeasibilityResponse = await fetchGroupFeasibilityFromVendor({
      vendorDetails,
      vendorGroupId,
    });

    const exactPrice =
      getGroupFeasibilityResponse?.data?.Feasibility?.Common[0]?.Estimate ||
      getGroupFeasibilityResponse?.data?.data;

    await SurveyVendorConfig.update(
      { quota_cost: exactPrice },
      { where: { id: surveyVendorConfigDetails.id } }
    );

    return res.status(200).send({
      message: "Exact value fetched successfully",
      data: { exactAmount: exactPrice },
    });
  } catch (error) {
    console.log("Error in getExactAmount: ", error);
    return res
      .status(500)
      .send({ message: "Server error", error: error.message });
  }
};
