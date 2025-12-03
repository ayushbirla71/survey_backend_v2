import prisma from "../config/db.js";
import {
  validateQuotaConfiguration,
  processCallbackUrl,
  callVendorCallback,
  formatQuotaStatus,
  getQuotaTarget,
} from "../utils/quotaUtils.js";

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
    } = req.body;

    // Check if survey exists and belongs to user
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, userId: req.user.id },
    });

    if (!survey) {
      return res
        .status(404)
        .json({ message: "Survey not found or access denied" });
    }

    // Check if quota already exists
    const existingQuota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
    });

    if (existingQuota) {
      return res.status(400).json({
        message: "Quota configuration already exists for this survey",
      });
    }

    // Validate quota configuration
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

    // Create quota with nested relations using transaction
    const quota = await prisma.$transaction(async (tx) => {
      const surveyQuota = await tx.surveyQuota.create({
        data: {
          surveyId,
          total_target,
          completed_url,
          terminated_url,
          quota_full_url,
        },
      });

      // Create age quotas
      if (age_quotas && age_quotas.length > 0) {
        await tx.ageQuota.createMany({
          data: age_quotas.map((q) => ({
            surveyQuotaId: surveyQuota.id,
            min_age: q.min_age,
            max_age: q.max_age,
            quota_type: q.quota_type || "COUNT",
            target_count: q.target_count,
            target_percentage: q.target_percentage,
          })),
        });
      }

      // Create gender quotas
      if (gender_quotas && gender_quotas.length > 0) {
        await tx.genderQuota.createMany({
          data: gender_quotas.map((q) => ({
            surveyQuotaId: surveyQuota.id,
            gender: q.gender,
            quota_type: q.quota_type || "COUNT",
            target_count: q.target_count,
            target_percentage: q.target_percentage,
          })),
        });
      }

      // Create location quotas
      if (location_quotas && location_quotas.length > 0) {
        await tx.locationQuota.createMany({
          data: location_quotas.map((q) => ({
            surveyQuotaId: surveyQuota.id,
            country: q.country,
            state: q.state,
            city: q.city,
            postal_code: q.postal_code,
            quota_type: q.quota_type || "COUNT",
            target_count: q.target_count,
            target_percentage: q.target_percentage,
          })),
        });
      }

      // Create category quotas
      if (category_quotas && category_quotas.length > 0) {
        await tx.categoryQuota.createMany({
          data: category_quotas.map((q) => ({
            surveyQuotaId: surveyQuota.id,
            surveyCategoryId: q.surveyCategoryId,
            quota_type: q.quota_type || "COUNT",
            target_count: q.target_count,
            target_percentage: q.target_percentage,
          })),
        });
      }

      return surveyQuota;
    });

    // Fetch complete quota with relations
    const completeQuota = await prisma.surveyQuota.findUnique({
      where: { id: quota.id },
      include: {
        age_quotas: true,
        gender_quotas: true,
        location_quotas: true,
        category_quotas: { include: { surveyCategory: true } },
      },
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

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: {
        age_quotas: true,
        gender_quotas: true,
        location_quotas: true,
        category_quotas: { include: { surveyCategory: true } },
      },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    res.json({ quota });
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
    const {
      total_target,
      completed_url,
      terminated_url,
      quota_full_url,
      is_active,
      age_quotas,
      gender_quotas,
      location_quotas,
      category_quotas,
    } = req.body;

    // Check if survey exists and belongs to user
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, userId: req.user.id },
    });

    if (!survey) {
      return res
        .status(404)
        .json({ message: "Survey not found or access denied" });
    }

    const existingQuota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
    });

    if (!existingQuota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    // Update using transaction
    const updatedQuota = await prisma.$transaction(async (tx) => {
      // Update main quota
      await tx.surveyQuota.update({
        where: { id: existingQuota.id },
        data: {
          total_target: total_target ?? existingQuota.total_target,
          completed_url: completed_url ?? existingQuota.completed_url,
          terminated_url: terminated_url ?? existingQuota.terminated_url,
          quota_full_url: quota_full_url ?? existingQuota.quota_full_url,
          is_active: is_active ?? existingQuota.is_active,
        },
      });

      // Update age quotas if provided
      if (age_quotas) {
        await tx.ageQuota.deleteMany({
          where: { surveyQuotaId: existingQuota.id },
        });
        if (age_quotas.length > 0) {
          await tx.ageQuota.createMany({
            data: age_quotas.map((q) => ({
              surveyQuotaId: existingQuota.id,
              min_age: q.min_age,
              max_age: q.max_age,
              quota_type: q.quota_type || "COUNT",
              target_count: q.target_count,
              target_percentage: q.target_percentage,
            })),
          });
        }
      }

      // Update gender quotas if provided
      if (gender_quotas) {
        await tx.genderQuota.deleteMany({
          where: { surveyQuotaId: existingQuota.id },
        });
        if (gender_quotas.length > 0) {
          await tx.genderQuota.createMany({
            data: gender_quotas.map((q) => ({
              surveyQuotaId: existingQuota.id,
              gender: q.gender,
              quota_type: q.quota_type || "COUNT",
              target_count: q.target_count,
              target_percentage: q.target_percentage,
            })),
          });
        }
      }

      // Update location quotas if provided
      if (location_quotas) {
        await tx.locationQuota.deleteMany({
          where: { surveyQuotaId: existingQuota.id },
        });
        if (location_quotas.length > 0) {
          await tx.locationQuota.createMany({
            data: location_quotas.map((q) => ({
              surveyQuotaId: existingQuota.id,
              country: q.country,
              state: q.state,
              city: q.city,
              postal_code: q.postal_code,
              quota_type: q.quota_type || "COUNT",
              target_count: q.target_count,
              target_percentage: q.target_percentage,
            })),
          });
        }
      }

      // Update category quotas if provided
      if (category_quotas) {
        await tx.categoryQuota.deleteMany({
          where: { surveyQuotaId: existingQuota.id },
        });
        if (category_quotas.length > 0) {
          await tx.categoryQuota.createMany({
            data: category_quotas.map((q) => ({
              surveyQuotaId: existingQuota.id,
              surveyCategoryId: q.surveyCategoryId,
              quota_type: q.quota_type || "COUNT",
              target_count: q.target_count,
              target_percentage: q.target_percentage,
            })),
          });
        }
      }

      return tx.surveyQuota.findUnique({
        where: { id: existingQuota.id },
        include: {
          age_quotas: true,
          gender_quotas: true,
          location_quotas: true,
          category_quotas: { include: { surveyCategory: true } },
        },
      });
    });

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

    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, userId: req.user.id },
    });

    if (!survey) {
      return res
        .status(404)
        .json({ message: "Survey not found or access denied" });
    }

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    await prisma.surveyQuota.delete({ where: { id: quota.id } });

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

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: {
        age_quotas: true,
        gender_quotas: true,
        location_quotas: true,
        category_quotas: { include: { surveyCategory: true } },
      },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    // Calculate status for each quota type
    const status = {
      survey_id: surveyId,
      total_target: quota.total_target,
      total_completed: quota.total_completed,
      total_terminated: quota.total_terminated,
      total_quota_full: quota.total_quota_full,
      overall_progress:
        Math.round((quota.total_completed / quota.total_target) * 100 * 100) /
        100,
      is_active: quota.is_active,
      age_quotas: quota.age_quotas.map((q) => ({
        ...q,
        ...formatQuotaStatus(q, quota.total_target),
      })),
      gender_quotas: quota.gender_quotas.map((q) => ({
        ...q,
        ...formatQuotaStatus(q, quota.total_target),
      })),
      location_quotas: quota.location_quotas.map((q) => ({
        ...q,
        ...formatQuotaStatus(q, quota.total_target),
      })),
      category_quotas: quota.category_quotas.map((q) => ({
        ...q,
        ...formatQuotaStatus(q, quota.total_target),
      })),
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

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: {
        age_quotas: true,
        gender_quotas: true,
        location_quotas: true,
        category_quotas: true,
      },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    if (!quota.is_active) {
      return res.status(400).json({
        qualified: false,
        status: "QUOTA_FULL",
        message: "Survey quota is not active",
        redirect_url: quota.quota_full_url,
      });
    }

    // Check if total quota is full
    if (quota.total_completed >= quota.total_target) {
      return res.status(200).json({
        qualified: false,
        status: "QUOTA_FULL",
        message: "Total survey quota is full",
        redirect_url: quota.quota_full_url,
      });
    }

    // Check each quota type
    const quotaChecks = [];

    // Check age quota
    if (age && quota.age_quotas.length > 0) {
      const matchingAgeQuota = quota.age_quotas.find(
        (q) => q.is_active && age >= q.min_age && age <= q.max_age
      );
      if (matchingAgeQuota) {
        const target = getQuotaTarget(matchingAgeQuota, quota.total_target);
        if (matchingAgeQuota.current_count >= target) {
          quotaChecks.push({
            type: "age",
            full: true,
            quota: matchingAgeQuota,
          });
        } else {
          quotaChecks.push({
            type: "age",
            full: false,
            quota: matchingAgeQuota,
          });
        }
      }
    }

    // Check gender quota
    if (gender && quota.gender_quotas.length > 0) {
      const matchingGenderQuota = quota.gender_quotas.find(
        (q) => q.is_active && q.gender === gender
      );
      if (matchingGenderQuota) {
        const target = getQuotaTarget(matchingGenderQuota, quota.total_target);
        if (matchingGenderQuota.current_count >= target) {
          quotaChecks.push({
            type: "gender",
            full: true,
            quota: matchingGenderQuota,
          });
        } else {
          quotaChecks.push({
            type: "gender",
            full: false,
            quota: matchingGenderQuota,
          });
        }
      }
    }

    // Check location quota
    if ((country || state || city) && quota.location_quotas.length > 0) {
      const matchingLocationQuota = quota.location_quotas.find((q) => {
        if (!q.is_active) return false;
        if (q.country && q.country !== country) return false;
        if (q.state && q.state !== state) return false;
        if (q.city && q.city !== city) return false;
        return true;
      });
      if (matchingLocationQuota) {
        const target = getQuotaTarget(
          matchingLocationQuota,
          quota.total_target
        );
        if (matchingLocationQuota.current_count >= target) {
          quotaChecks.push({
            type: "location",
            full: true,
            quota: matchingLocationQuota,
          });
        } else {
          quotaChecks.push({
            type: "location",
            full: false,
            quota: matchingLocationQuota,
          });
        }
      }
    }

    // Check category quota
    if (surveyCategoryId && quota.category_quotas.length > 0) {
      const matchingCategoryQuota = quota.category_quotas.find(
        (q) => q.is_active && q.surveyCategoryId === surveyCategoryId
      );
      if (matchingCategoryQuota) {
        const target = getQuotaTarget(
          matchingCategoryQuota,
          quota.total_target
        );
        if (matchingCategoryQuota.current_count >= target) {
          quotaChecks.push({
            type: "category",
            full: true,
            quota: matchingCategoryQuota,
          });
        } else {
          quotaChecks.push({
            type: "category",
            full: false,
            quota: matchingCategoryQuota,
          });
        }
      }
    }

    // If any quota is full, respondent doesn't qualify
    const fullQuotas = quotaChecks.filter((c) => c.full);
    if (fullQuotas.length > 0) {
      return res.status(200).json({
        qualified: false,
        status: "QUOTA_FULL",
        message: `Quota full for: ${fullQuotas.map((q) => q.type).join(", ")}`,
        redirect_url: quota.quota_full_url,
        full_quotas: fullQuotas.map((q) => q.type),
      });
    }

    // Create respondent record
    const respondent = await prisma.quotaRespondent.create({
      data: {
        surveyQuotaId: quota.id,
        vendor_respondent_id,
        age,
        gender,
        country,
        state,
        city,
        surveyCategoryId,
        status: "QUALIFIED",
      },
    });

    res.status(200).json({
      qualified: true,
      status: "QUALIFIED",
      message: "Respondent qualifies for survey",
      respondent_id: respondent.id,
      survey_id: surveyId,
    });
  } catch (error) {
    console.error("Check respondent quota error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Mark respondent as completed
 * @route POST /api/quota/:surveyId/complete
 * @access Public (for vendor integration)
 */
export const markRespondentCompleted = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { respondent_id, response_id } = req.body;

    const respondent = await prisma.quotaRespondent.findUnique({
      where: { id: respondent_id },
      include: { surveyQuota: true },
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

    // Update respondent and quota counts in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update respondent status
      const updatedRespondent = await tx.quotaRespondent.update({
        where: { id: respondent_id },
        data: {
          status: "COMPLETED",
          responseId: response_id,
          redirect_url_called: respondent.surveyQuota.completed_url,
          redirect_called_at: new Date(),
        },
      });

      // Update survey quota total
      await tx.surveyQuota.update({
        where: { id: respondent.surveyQuotaId },
        data: { total_completed: { increment: 1 } },
      });

      // Update specific quota counts based on respondent data
      if (respondent.age) {
        const ageQuota = await tx.ageQuota.findFirst({
          where: {
            surveyQuotaId: respondent.surveyQuotaId,
            min_age: { lte: respondent.age },
            max_age: { gte: respondent.age },
          },
        });
        if (ageQuota) {
          await tx.ageQuota.update({
            where: { id: ageQuota.id },
            data: { current_count: { increment: 1 } },
          });
        }
      }

      if (respondent.gender) {
        await tx.genderQuota.updateMany({
          where: {
            surveyQuotaId: respondent.surveyQuotaId,
            gender: respondent.gender,
          },
          data: { current_count: { increment: 1 } },
        });
      }

      if (respondent.country || respondent.state || respondent.city) {
        const locationQuota = await tx.locationQuota.findFirst({
          where: {
            surveyQuotaId: respondent.surveyQuotaId,
            OR: [
              { country: respondent.country },
              { state: respondent.state },
              { city: respondent.city },
            ],
          },
        });
        if (locationQuota) {
          await tx.locationQuota.update({
            where: { id: locationQuota.id },
            data: { current_count: { increment: 1 } },
          });
        }
      }

      if (respondent.surveyCategoryId) {
        await tx.categoryQuota.updateMany({
          where: {
            surveyQuotaId: respondent.surveyQuotaId,
            surveyCategoryId: respondent.surveyCategoryId,
          },
          data: { current_count: { increment: 1 } },
        });
      }

      return updatedRespondent;
    });

    // Call vendor callback
    const callbackUrl = processCallbackUrl(
      respondent.surveyQuota.completed_url,
      {
        vendor_respondent_id: respondent.vendor_respondent_id,
        surveyId,
        status: "COMPLETED",
      }
    );

    let callbackResult = null;
    if (callbackUrl) {
      callbackResult = await callVendorCallback(callbackUrl);
    }

    res.json({
      message: "Respondent marked as completed",
      respondent: result,
      redirect_url: callbackUrl,
      callback_result: callbackResult,
    });
  } catch (error) {
    console.error("Mark completed error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc Mark respondent as terminated
 * @route POST /api/quota/:surveyId/terminate
 * @access Public (for vendor integration)
 */
export const markRespondentTerminated = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { respondent_id, reason } = req.body;

    const respondent = await prisma.quotaRespondent.findUnique({
      where: { id: respondent_id },
      include: { surveyQuota: true },
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

    // Update respondent and quota counts in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedRespondent = await tx.quotaRespondent.update({
        where: { id: respondent_id },
        data: {
          status: "TERMINATED",
          redirect_url_called: respondent.surveyQuota.terminated_url,
          redirect_called_at: new Date(),
        },
      });

      await tx.surveyQuota.update({
        where: { id: respondent.surveyQuotaId },
        data: { total_terminated: { increment: 1 } },
      });

      return updatedRespondent;
    });

    // Call vendor callback
    const callbackUrl = processCallbackUrl(
      respondent.surveyQuota.terminated_url,
      {
        vendor_respondent_id: respondent.vendor_respondent_id,
        surveyId,
        status: "TERMINATED",
      }
    );

    let callbackResult = null;
    if (callbackUrl) {
      callbackResult = await callVendorCallback(callbackUrl);
    }

    res.json({
      message: "Respondent marked as terminated",
      respondent: result,
      reason,
      redirect_url: callbackUrl,
      callback_result: callbackResult,
    });
  } catch (error) {
    console.error("Mark terminated error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
