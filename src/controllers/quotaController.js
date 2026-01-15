import axios from "axios";
import prisma from "../config/db.js";
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

      // Create screening questions with options
      if (screening_questions && screening_questions.length > 0) {
        for (let i = 0; i < screening_questions.length; i++) {
          const question = screening_questions[i];
          await tx.screeningQuestion.create({
            data: {
              surveyQuotaId: surveyQuota.id,
              question_id: question.id,
              type: mapScreeningQuestionType(question.type),
              question_text: question.question_text,
              required: question.required ?? true,
              order_index: i,
              options: {
                create: question.options.map((opt, optIndex) => ({
                  option_id: opt.id,
                  label: opt.label,
                  value: opt.value,
                  order_index: optIndex,
                })),
              },
            },
          });
        }
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
        screening_questions: {
          include: { options: true },
          orderBy: { order_index: "asc" },
        },
      },
    });

    // Format screening questions to match frontend format
    const formattedQuota = {
      ...completeQuota,
      screening_questions: formatScreeningQuestionsForResponse(
        completeQuota.screening_questions
      ),
    };

    res.status(201).json({
      message: "Quota configuration created successfully",
      quota: formattedQuota,
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
        screening_questions: {
          include: { options: true },
          orderBy: { order_index: "asc" },
        },
      },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    // Format screening questions to match frontend format
    const formattedQuota = {
      ...quota,
      screening_questions: formatScreeningQuestionsForResponse(
        quota.screening_questions
      ),
    };

    res.json(formattedQuota);
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
      screening_questions,
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

    const existingQuota = await prisma.surveyQuota.findFirst({
      where: { surveyId },
    });

    if (!existingQuota) {
      // return res.status(404).json({ message: "Quota configuration not found" });
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

        // Create screening questions with options
        if (screening_questions && screening_questions.length > 0) {
          for (let i = 0; i < screening_questions.length; i++) {
            const question = screening_questions[i];
            await tx.screeningQuestion.create({
              data: {
                surveyQuotaId: surveyQuota.id,
                question_id: question.id,
                type: mapScreeningQuestionType(question.type),
                question_text: question.question_text,
                required: question.required ?? true,
                order_index: i,
                options: {
                  create: question.options.map((opt, optIndex) => ({
                    option_id: opt.id,
                    label: opt.label,
                    value: opt.value,
                    order_index: optIndex,
                  })),
                },
              },
            });
          }
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
          screening_questions: {
            include: { options: true },
            orderBy: { order_index: "asc" },
          },
        },
      });

      // Format screening questions to match frontend format
      const formattedQuota = {
        ...completeQuota,
        screening_questions: formatScreeningQuestionsForResponse(
          completeQuota.screening_questions
        ),
      };

      return res.status(201).json({
        message: "Quota configuration created successfully",
        quota: formattedQuota,
      });
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

      // Update screening questions if provided
      if (screening_questions) {
        // Delete existing screening questions (cascades to options)
        await tx.screeningQuestion.deleteMany({
          where: { surveyQuotaId: existingQuota.id },
        });
        // Create new screening questions with options
        if (screening_questions.length > 0) {
          for (let i = 0; i < screening_questions.length; i++) {
            const question = screening_questions[i];
            await tx.screeningQuestion.create({
              data: {
                surveyQuotaId: existingQuota.id,
                question_id: question.id,
                type: mapScreeningQuestionType(question.type),
                question_text: question.question_text,
                required: question.required ?? true,
                order_index: i,
                options: {
                  create: question.options.map((opt, optIndex) => ({
                    option_id: opt.id,
                    label: opt.label,
                    value: opt.value,
                    order_index: optIndex,
                  })),
                },
              },
            });
          }
        }
      }

      return tx.surveyQuota.findUnique({
        where: { id: existingQuota.id },
        include: {
          age_quotas: true,
          gender_quotas: true,
          location_quotas: true,
          category_quotas: { include: { surveyCategory: true } },
          screening_questions: {
            include: { options: true },
            orderBy: { order_index: "asc" },
          },
        },
      });
    });

    // Format screening questions to match frontend format
    const formattedQuota = {
      ...updatedQuota,
      screening_questions: formatScreeningQuestionsForResponse(
        updatedQuota.screening_questions
      ),
    };

    res.json({
      message: "Quota configuration updated successfully",
      quota: formattedQuota,
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
        screening_questions: {
          include: { options: true },
          orderBy: { order_index: "asc" },
        },
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
      screening_questions: formatScreeningQuestionsForResponse(
        quota.screening_questions
      ),
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

    // Fetch quota with all related data in single query
    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: {
        age_quotas: { where: { is_active: true } },
        gender_quotas: { where: { is_active: true } },
        location_quotas: { where: { is_active: true } },
        category_quotas: { where: { is_active: true } },
      },
    });

    if (!quota) {
      return res.status(404).json({ message: "Quota configuration not found" });
    }

    // Common respondent data for creating records
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

    // Helper: Save respondent and update quota counts, then return response
    const saveAndRespond = async (status, message, quotaType = null) => {
      const isQuotaFull = status === "QUOTA_FULL";
      const isTerminated = status === "TERMINATED";

      const redirectUrlForDB = isQuotaFull
        ? quota.quota_full_url
        : isTerminated
        ? quota.terminated_url
        : null;

      const redirectUpdateFields = redirectUrlForDB
        ? {
            redirect_url_called: redirectUrlForDB,
            redirect_called_at: new Date(),
          }
        : {};

      // Use transaction to ensure atomicity
      const respondent = await prisma.$transaction(async (tx) => {
        // Create respondent record
        const newRespondent = await tx.quotaRespondent.create({
          data: { ...respondentData, status, ...redirectUpdateFields },
        });

        // Update quota counts based on status
        if (isQuotaFull) {
          await tx.surveyQuota.update({
            where: { id: quota.id },
            data: { total_quota_full: { increment: 1 } },
          });
        } else if (isTerminated) {
          await tx.surveyQuota.update({
            where: { id: quota.id },
            data: { total_terminated: { increment: 1 } },
          });
        }

        // Here i also have to add the code for calling the vendor callback URL (this one need to be checked)
        // if (redirectUrlForDB) {
        //   const callbackResult = await callVendorCallback(redirectUrlForDB);
        //   await tx.quotaRespondent.update({
        //     where: { id: newRespondent.id },
        //     data: { callback_result: JSON.stringify(callbackResult) },
        //   });
        // } else {
        //   await tx.quotaRespondent.update({
        //     where: { id: newRespondent.id },
        //     data: { callback_result: JSON.stringify({ success: false }) },
        //   });
        // }

        return newRespondent;
      });

      const redirectUrl = isQuotaFull
        ? quota.quota_full_url
        : quota.terminated_url;

      return res.status(200).json({
        qualified: false,
        status,
        message,
        redirect_url: redirectUrl,
        respondent_id: respondent.id,
        quota_type: quotaType,
      });
    };

    // Helper: Calculate target count from percentage
    const getTarget = (q) =>
      q.target_count ??
      Math.ceil((q.target_percentage / 100) * quota.total_target);

    // ---------------- CHECK: Survey inactive ----------------
    if (!quota.is_active) {
      return saveAndRespond("QUOTA_FULL", "Survey quota is not active");
    }

    // ---------------- CHECK: Total quota full ----------------
    if (quota.total_completed >= quota.total_target) {
      return saveAndRespond("QUOTA_FULL", "Total survey quota is full");
    }

    // ---------------- CHECK: Age ----------------
    if (age !== undefined && quota.age_quotas.length > 0) {
      const match = quota.age_quotas.find(
        (q) => age >= q.min_age && age <= q.max_age
      );

      if (!match) {
        return saveAndRespond(
          "TERMINATED",
          "Age does not match any allowed quota range",
          "AGE"
        );
      }

      if (match.current_count >= getTarget(match)) {
        return saveAndRespond("QUOTA_FULL", "Age quota is full", "AGE");
      }
    }

    // ---------------- CHECK: Gender ----------------
    if (gender && quota.gender_quotas.length > 0) {
      const match = quota.gender_quotas.find((q) => q.gender === gender);

      if (!match) {
        return saveAndRespond(
          "TERMINATED",
          "Gender does not match any allowed quota",
          "GENDER"
        );
      }

      if (match.current_count >= getTarget(match)) {
        return saveAndRespond("QUOTA_FULL", "Gender quota is full", "GENDER");
      }
    }

    // ---------------- CHECK: Location ----------------
    if (quota.location_quotas.length > 0) {
      const match = quota.location_quotas.find((q) => {
        if (q.country && q.country.toLowerCase() !== country?.toLowerCase())
          return false;
        if (q.state && q.state.toLowerCase() !== state?.toLowerCase())
          return false;
        if (q.city && q.city.toLowerCase() !== city?.toLowerCase())
          return false;
        return true;
      });

      if (!match) {
        return saveAndRespond(
          "TERMINATED",
          "Location does not match any allowed quota",
          "LOCATION"
        );
      }

      if (match.current_count >= getTarget(match)) {
        return saveAndRespond(
          "QUOTA_FULL",
          "Location quota is full",
          "LOCATION"
        );
      }
    }

    // ---------------- CHECK: Category ----------------
    if (surveyCategoryId && quota.category_quotas.length > 0) {
      const match = quota.category_quotas.find(
        (q) => q.surveyCategoryId === surveyCategoryId
      );

      if (!match) {
        return saveAndRespond(
          "TERMINATED",
          "Category does not match any allowed quota",
          "CATEGORY"
        );
      }

      if (match.current_count >= getTarget(match)) {
        return saveAndRespond(
          "QUOTA_FULL",
          "Category quota is full",
          "CATEGORY"
        );
      }
    }

    // ---------------- QUALIFIED ----------------
    const respondent = await prisma.quotaRespondent.create({
      data: { ...respondentData, status: "QUALIFIED" },
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

// export const checkRespondentQuota = async (req, res) => {
//   try {
//     console.log(
//       ">>>>>>> Entered the CHECK RESPONDENT QUOTA FUNCTION.........."
//     );

//     const { surveyId } = req.params;
//     const {
//       vendor_respondent_id,
//       age,
//       gender,
//       country,
//       state,
//       city,
//       surveyCategoryId,
//     } = req.body;

//     console.log(">>>>>>> the value of the REQUEST BODY is : ", req.body);

//     const quota = await prisma.surveyQuota.findUnique({
//       where: { surveyId },
//       include: {
//         age_quotas: true,
//         gender_quotas: true,
//         location_quotas: true,
//         category_quotas: true,
//       },
//     });
//     console.log(">>>>>>> the value of the QUOTA is : ", quota);

//     if (!quota) {
//       return res.status(404).json({ message: "Quota configuration not found" });
//     }

//     if (!quota.is_active) {
//       return res.status(400).json({
//         qualified: false,
//         status: "QUOTA_FULL",
//         message: "Survey quota is not active",
//         redirect_url: quota.quota_full_url,
//       });
//     }

//     // Check if total quota is full
//     if (quota.total_completed >= quota.total_target) {
//       await prisma.quotaRespondent.create({
//         data: {
//           surveyQuotaId: quota.id,
//           vendor_respondent_id,
//           age,
//           gender,
//           country,
//           state,
//           city,
//           surveyCategoryId,
//           status: "QUOTA_FULL",
//         },
//       });

//       return res.status(200).json({
//         qualified: false,
//         status: "QUOTA_FULL",
//         message: "Total survey quota is full",
//         redirect_url: quota.quota_full_url,
//       });
//     }

//     // Check each quota type
//     const quotaChecks = [];

//     // Check age quota
//     if (age && quota.age_quotas.length > 0) {
//       console.log(">>>>>>> Checking Age Quota...........");
//       console.log(">>>>>>> The value of the AGE is : ", age);
//       console.log(">>>>>>> The value of the QUOTA AGE is : ", quota.age_quotas);
//       const matchingAgeQuota = quota.age_quotas.find(
//         (q) => q.is_active && age >= q.min_age && age <= q.max_age
//       );
//       console.log(
//         ">>>>>>> The value of the MATCHING AGE QUOTA is : ",
//         matchingAgeQuota
//       );
//       if (!matchingAgeQuota) {
//         await prisma.quotaRespondent.create({
//           data: {
//             surveyQuotaId: quota.id,
//             vendor_respondent_id,
//             age,
//             gender,
//             country,
//             state,
//             city,
//             surveyCategoryId,
//             status: "TERMINATED",
//           },
//         });

//         return res.status(200).json({
//           qualified: false,
//           status: "TERMINATED",
//           message: "Age does not match any allowed quota range",
//           redirect_url: quota.terminated_url,
//         });
//       }

//       const target = getQuotaTarget(matchingAgeQuota, quota.total_target);
//       quotaChecks.push({
//         type: "age",
//         full: matchingAgeQuota.current_count >= target,
//         quota: matchingAgeQuota,
//       });
//     }

//     // Check gender quota
//     if (gender && quota.gender_quotas.length > 0) {
//       const matchingGenderQuota = quota.gender_quotas.find(
//         (q) => q.is_active && q.gender === gender
//       );
//       if (!matchingGenderQuota) {
//         await prisma.quotaRespondent.create({
//           data: {
//             surveyQuotaId: quota.id,
//             vendor_respondent_id,
//             age,
//             gender,
//             country,
//             state,
//             city,
//             surveyCategoryId,
//             status: "TERMINATED",
//           },
//         });

//         return res.status(200).json({
//           qualified: false,
//           status: "TERMINATED",
//           message: "Gender does not match any allowed quota",
//           redirect_url: quota.terminated_url,
//         });
//       }

//       const target = getQuotaTarget(matchingGenderQuota, quota.total_target);
//       quotaChecks.push({
//         type: "gender",
//         full: matchingGenderQuota.current_count >= target,
//         quota: matchingGenderQuota,
//       });
//     }

//     // Check location quota
//     if ((country || state || city) && quota.location_quotas.length > 0) {
//       const matchingLocationQuota = quota.location_quotas.find((q) => {
//         if (!q.is_active) return false;
//         if (q.country && q.country !== country) return false;
//         if (q.state && q.state !== state) return false;
//         if (q.city && q.city !== city) return false;
//         return true;
//       });
//       if (!matchingLocationQuota) {
//         await prisma.quotaRespondent.create({
//           data: {
//             surveyQuotaId: quota.id,
//             vendor_respondent_id,
//             age,
//             gender,
//             country,
//             state,
//             city,
//             surveyCategoryId,
//             status: "TERMINATED",
//           },
//         });

//         return res.status(200).json({
//           qualified: false,
//           status: "TERMINATED",
//           message: "Location does not match any allowed quota",
//           redirect_url: quota.terminated_url,
//         });
//       }

//       const target = getQuotaTarget(matchingLocationQuota, quota.total_target);
//       quotaChecks.push({
//         type: "location",
//         full: matchingLocationQuota.current_count >= target,
//       });
//     }

//     // Check category quota
//     if (surveyCategoryId && quota.category_quotas.length > 0) {
//       const matchingCategoryQuota = quota.category_quotas.find(
//         (q) => q.is_active && q.surveyCategoryId === surveyCategoryId
//       );
//       if (!matchingCategoryQuota) {
//         await prisma.quotaRespondent.create({
//           data: {
//             surveyQuotaId: quota.id,
//             vendor_respondent_id,
//             age,
//             gender,
//             country,
//             state,
//             city,
//             surveyCategoryId,
//             status: "TERMINATED",
//           },
//         });

//         return res.status(200).json({
//           qualified: false,
//           status: "TERMINATED",
//           message: "Category does not match any allowed quota",
//           redirect_url: quota.terminated_url,
//         });
//       }

//       const target = getQuotaTarget(matchingCategoryQuota, quota.total_target);
//       quotaChecks.push({
//         type: "category",
//         full: matchingCategoryQuota.current_count >= target,
//       });
//     }

//     // If any quota is full, respondent doesn't qualify
//     const fullQuotas = quotaChecks.filter((c) => c.full);
//     if (fullQuotas.length > 0) {
//       await prisma.quotaRespondent.create({
//         data: {
//           surveyQuotaId: quota.id,
//           vendor_respondent_id,
//           age,
//           gender,
//           country,
//           state,
//           city,
//           surveyCategoryId,
//           status: "DISQUALIFIED",
//         },
//       });

//       return res.status(200).json({
//         qualified: false,
//         status: "QUOTA_FULL",
//         message: `Quota full for: ${fullQuotas.map((q) => q.type).join(", ")}`,
//         redirect_url: quota.quota_full_url,
//         full_quotas: fullQuotas.map((q) => q.type),
//       });
//     }

//     // Create respondent record
//     const respondent = await prisma.quotaRespondent.create({
//       data: {
//         surveyQuotaId: quota.id,
//         vendor_respondent_id,
//         age,
//         gender,
//         country,
//         state,
//         city,
//         surveyCategoryId,
//         status: "QUALIFIED",
//       },
//     });

//     res.status(200).json({
//       qualified: true,
//       status: "QUALIFIED",
//       message: "Respondent qualifies for survey",
//       respondent_id: respondent.id,
//       survey_id: surveyId,
//     });
//   } catch (error) {
//     console.error("Check respondent quota error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

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

//  *******************   QUOTA V2   ******************************

const prepareInnovaeMRTargetPayload = async (screening) => {
  try {
    console.log(
      ">>>> the value of the SCREENING in prepareInnovaeMRPayload is : ",
      screening
    );
    if (!screening || !Array.isArray(screening)) return [];

    // extract questionIds without option targets for bulk lookup
    const noTargetIds = screening
      .filter((q) => !q.optionTargets || q.optionTargets.length === 0)
      .map((q) => q.questionId);

    // bulk fetch definitions instead of N queries
    const defs = await prisma.screeningQuestionDefinition.findMany({
      where: { id: { in: noTargetIds } },
    });

    const defsById = Object.fromEntries(defs.map((d) => [d.id, d]));

    const payload = await Promise.all(
      screening.map(async (q) => {
        const hasTargets = q.optionTargets && q.optionTargets.length > 0;
        const vendorQuestionId = parseInt(q.vendorQuestionId);

        if (hasTargets) {
          const opts = q.optionTargets
            .filter((o) => o.target > 0)
            .map((o) => parseInt(o.vendorOptionId));

          return opts.length > 0
            ? { questionId: vendorQuestionId, Options: opts }
            : null;
        }

        const def = defsById[q.questionId];
        if (!def) return null;

        switch (def.question_key) {
          case "AGE":
            return {
              questionId: vendorQuestionId,
              Options: q.buckets.map((b) => `${b.value.min}-${b.value.max}`),
            };
          case "ZIPCODES":
            return {
              questionId: vendorQuestionId,
              Options: q.buckets.flatMap((b) =>
                Array.isArray(b.value) ? b.value : [b.value]
              ),
            };
          default:
            return null;
        }
      })
    );

    return payload.filter(Boolean);
  } catch (error) {
    console.error("Prepare InnovateMR Payload Error:", error);
    throw new Error("Failed to prepare InnovateMR payload.");
  }
};

const addSurveyToInnovaeMR = async (
  survey,
  vendorId,
  totalTarget,
  screening
) => {
  try {
    console.log(
      ">>>> the value of the SURVEY in addSurveyToInnovaeMR is : ",
      survey
    );
    console.log(
      ">>>> the value of the VENDOR ID in addSurveyToInnovaeMR is : ",
      vendorId
    );
    console.log(
      ">>>> the value of the TOTAL TARGET in addSurveyToInnovaeMR is : ",
      totalTarget
    );
    console.log(
      ">>>> the value of the SCREENING in addSurveyToInnovaeMR is : ",
      screening
    );

    const vendorDetails = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        api_configs: { where: { is_default: true, is_active: true } },
      },
    });
    console.log(
      ">>>> the value of the VENDOR DETAILS in addSurveyToInnovaeMR is : ",
      vendorDetails
    );
    if (!vendorDetails) {
      throw new Error("Vendor not found");
    }
    if (vendorDetails.api_configs.length === 0) {
      throw new Error("No active API config found");
    }

    const apiConfig =
      vendorDetails.api_configs[vendorDetails.api_configs.length - 1];
    const { id: apiConfigId, base_url, credentials } = apiConfig;

    // Check if JOB already created on VENDOR side
    const isSurveyVendorConfigExist = await prisma.surveyVendorConfig.findFirst(
      {
        where: { surveyId: survey.id, vendorId: vendorDetails.id },
      }
    );
    console.log(
      ">>>> the value of the isSurveyVendorConfigExist in addSurveyToInnovaeMR is : ",
      isSurveyVendorConfigExist
    );

    let job_id = isSurveyVendorConfigExist
      ? JSON.parse(isSurveyVendorConfigExist.vendor_survey_id)
      : null;
    console.log(
      ">>>> the value of the JOB ID in addSurveyToInnovaeMR is : ",
      job_id
    );

    let surveyVendorConfigId = isSurveyVendorConfigExist
      ? isSurveyVendorConfigExist.id
      : null;
    console.log(
      ">>>> the value of the surveyVendorConfigId in addSurveyToInnovaeMR is : ",
      surveyVendorConfigId
    );

    if (!job_id) {
      const createJobResponse = await axios.post(
        `${base_url}/pega/job`,
        {
          Name: survey.title,
          Status: 0,
          Category: 1, // it must me number from 1 to 43
        },
        {
          headers: {
            "x-access-token": `${credentials.token}`,
          },
        }
      );
      console.log(
        ">>>>> the value of the createJobResponse from INNOVATE MR is : ",
        createJobResponse.data
      );
      const validatedCreateJobResponse = validateInnovateMRResponse(
        createJobResponse,
        "Create Job"
      );
      console.log(
        ">>>>> the value of the validatedCreateJobResponse from INNOVATE MR is : ",
        validatedCreateJobResponse
      );

      job_id = createJobResponse.data?.job?.Id;
      console.log(">>>>> the value of the JOB ID is : ", job_id);

      const createSurveyVendorConfig = await prisma.surveyVendorConfig.create({
        data: {
          surveyId: survey.id,
          vendorId: vendorDetails.id,
          api_config_id: apiConfigId,
          vendor_survey_id: JSON.stringify(job_id),
          status: "CREATED",
        },
      });
      console.log(
        ">>>>> the value of the createSurveyVendorConfig is : ",
        createSurveyVendorConfig
      );

      surveyVendorConfigId = createSurveyVendorConfig.id;
    }

    // Adding GROUP to the JOB
    const createGroupResponse = await axios.post(
      `${base_url}/pega/jobs/${job_id}/group`,
      {
        Name: survey.title + " - Group",
        N: totalTarget,
        IncidenceRate: 80,
        LengthOfInterview: 2,
        LiveSurveyUrl:
          process.env.BACKEND_URL +
          `/webhook/innovate/${survey.id}?tk=[%%token%%]&pid=[%%pid%%]`, // TODO: Add the live survey url
        Target: { Country: "India", Languages: "ENGLISH" },
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      }
    );
    console.log(
      ">>>>> the value of the createGroupResponse from INNOVATE MR is : ",
      createGroupResponse.data
    );
    const validatedCreateGroupResponse = validateInnovateMRResponse(
      createGroupResponse,
      "Create Group"
    );
    console.log(
      ">>>>> the value of the validatedCreateGroupResponse from INNOVATE MR is : ",
      validatedCreateGroupResponse
    );

    const group_id = createGroupResponse.data?.group?.Id;
    console.log(">>>>> the value of the GROUP ID is : ", group_id);

    const updateSurveyVendorConfig = await prisma.surveyVendorConfig.update({
      where: { id: surveyVendorConfigId },
      data: { vendor_group_id: JSON.stringify(group_id) },
    });
    console.log(
      ">>>>> the value of the updateSurveyVendorConfig is : ",
      updateSurveyVendorConfig
    );

    const vendorTargetPayload = await prepareInnovaeMRTargetPayload(screening);
    console.log(
      ">>>> the value of the VENDOR TARGET PAYLOAD in distributeOverInnovateMR is : ",
      vendorTargetPayload
    );

    for (const target of vendorTargetPayload) {
      try {
        const createVendorTargetResponse = await axios.post(
          `${base_url}/pega/group/${group_id}/target`,
          {
            QuestionId: target.questionId,
            Options: target.Options,
          },
          {
            headers: {
              "x-access-token": `${credentials.token}`,
            },
            timeout: 10000,
          }
        );
        console.log(
          ">>>> the value of the createVendorTargetResponse is : ",
          createVendorTargetResponse.data
        );
        const validatedCreateVendorTargetResponse = validateInnovateMRResponse(
          createVendorTargetResponse,
          "Create Vendor Target"
        );
        console.log(
          ">>>>> the value of the validatedCreateVendorTargetResponse from INNOVATE MR is : ",
          validatedCreateVendorTargetResponse
        );
      } catch (error) {
        console.error("Distribute Over InnovateMR Error:", error);
        throw new Error("Failed to distribute over InnovateMR.");
      }
    }

    const updateSurveyVendorConfigWithTarget =
      await prisma.surveyVendorConfig.update({
        where: { id: surveyVendorConfigId },
        data: { is_target_added: true },
      });
    console.log(
      ">>>>> the value of the updateSurveyVendorConfigWithTarget is : ",
      updateSurveyVendorConfigWithTarget
    );

    const conditions = buildQuotaConditions(vendorTargetPayload);
    console.log(
      ">>>> the value of the CONDITIONS in distributeOverInnovateMR is : ",
      conditions
    );

    const addQuotaToGroupResponse = await axios.post(
      `${base_url}/pega/quota`,
      {
        Title: survey.title + " - Quota",
        HardStop: true,
        HardStopType: 0,
        N: totalTarget,
        GroupId: group_id,
        Conditions: conditions,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
        timeout: 10000,
      }
    );
    console.log(
      ">>>>> the value of the addQuotaToGroupResponse is : ",
      addQuotaToGroupResponse.data
    );
    const validatedAddQuotaToGroupResponse = validateInnovateMRResponse(
      addQuotaToGroupResponse,
      "Add Quota to Group"
    );
    console.log(
      ">>>>> the value of the validatedAddQuotaToGroupResponse from INNOVATE MR is : ",
      validatedAddQuotaToGroupResponse
    );

    const quota_id = addQuotaToGroupResponse.data?.Quota?.Id;
    console.log(">>>>> the value of the QUOTA ID is : ", quota_id);

    const updateSurveyVendorConfigWithQuota =
      await prisma.surveyVendorConfig.update({
        where: { id: surveyVendorConfigId },
        data: { vendor_quota_id: JSON.stringify(quota_id) },
      });
    console.log(
      ">>>>> the value of the updateSurveyVendorConfigWithQuota is : ",
      updateSurveyVendorConfigWithQuota
    );

    return true;
  } catch (error) {
    console.error("Add Survey to InnovateMR Error:", error);
    throw new Error("Failed to add survey to InnovateMR.");
  }
};

export const updateQuota_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;
    console.log(">>>>> the value  of the SURVEY ID is : ", surveyId);

    console.log(">>>>> the value  of the REQUEST BODY is : ", req.body);
    const { enabled, totalTarget, screening, vendorId, countryCode, language } =
      req.body;

    const filteredScreening = screening.map((q) => ({
      questionId: q.questionId,
      vendorQuestionId: q.vendorQuestionId,
      optionTargets: (q.optionTargets ?? []).filter((o) => o.target > 0),
      buckets: (q.buckets ?? []).filter((b) => b.target > 0),
    }));
    console.log(
      ">>>>> the value  of the FILTERED SCREENING is : ",
      filteredScreening
    );

    const survey = await prisma.survey.findFirst({
      where: { id: surveyId },
    });
    console.log(">>>>> the value  of the SURVEY is : ", survey);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    await prisma.$transaction(async (tx) => {
      const quota = await tx.surveyQuota.upsert({
        where: { surveyId },
        update: {
          target_count: totalTarget,
          is_active: enabled,
          country_code: countryCode,
          language,
          ...(vendorId && { vendorId }), // only if present
        },
        create: {
          surveyId,
          target_count: totalTarget,
          is_active: enabled,
          current_count: 0,
          country_code: countryCode,
          language,
          ...(vendorId && { vendorId }), // only if present
        },
      });
      console.log(">>>>> the value  of the QUOTA is : ", quota);

      const deletedOptions = await tx.surveyQuotaOption.deleteMany({
        where: { quotaId: quota.id },
      });
      console.log(
        ">>>>> the value  of the DELETED OPTIONS is : ",
        deletedOptions
      );
      await tx.surveyQuotaBucket.deleteMany({ where: { quotaId: quota.id } });

      for (const q of filteredScreening) {
        for (const opt of q.optionTargets) {
          if (opt.target <= 0) continue;

          await tx.surveyQuotaOption.create({
            data: {
              quotaId: quota.id,
              screeningQuestionId: q.questionId,
              screeningOptionId: opt.optionId,
              target_count: opt.target,
              current_count: 0,
            },
          });
        }

        for (const b of q.buckets) {
          await tx.surveyQuotaBucket.create({
            data: {
              quotaId: quota.id,
              screeningQuestionId: q.questionId,
              label: b.label ?? null,
              operator: b.operator,
              value: b.value,
              target_count: b.target,
              current_count: 0,
              is_active: true,
            },
          });
        }
      }
    });

    if (survey.survey_send_by === "VENDOR") {
      const innovateMrResponse = await addSurveyToInnovaeMR(
        survey,
        vendorId,
        totalTarget,
        filteredScreening
      );
      console.log(
        ">>>>> the value  of the INNOVATE MR RESPONSE is : ",
        innovateMrResponse
      );
    }

    return res.json({ message: "Quota updated" });
  } catch (error) {
    console.error("Update Quota Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const getQuota_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;
    console.log(">>>>> the value  of the SURVEY ID is : ", surveyId);

    const survey = await prisma.survey.findFirst({
      where: { id: surveyId },
    });
    console.log(">>>>> the value  of the SURVEY is : ", survey);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: { quota_options: true, quota_buckets: true },
    });
    console.log(">>>>> the value  of the QUOTA is : ", quota);
    if (!quota) return res.status(404).json({ message: "Quota not found" });

    /**
     * STEP 1: Group quota_options by screeningQuestionId
     */
    const questionMap = new Map();

    quota.quota_options.forEach((option) => {
      const questionId = option.screeningQuestionId;

      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          questionId,
          id: questionId,
          optionTargets: [],
          buckets: [],
        });
      }

      questionMap.get(questionId).optionTargets.push({
        optionId: option.screeningOptionId,
        option_id: option.screeningOptionId,
        target: option.target_count,
        current: option.current_count,
      });
    });

    quota.quota_buckets.forEach((b) => {
      const questionId = b.screeningQuestionId;

      if (!questionMap.has(questionId)) {
        questionMap.set(questionId, {
          questionId,
          id: questionId,
          optionTargets: [],
          buckets: [],
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

    /**
     * STEP 2: Convert map → array
     */
    const screeningquestions = Array.from(questionMap.values());

    /**
     * STEP 3: Final formatted response
     */
    const formattedQuota = {
      id: quota.id,
      surveyId: quota.surveyId,
      totaltarget: quota.target_count,
      country_code: quota.country_code,
      language: quota.language,
      vendorId: quota.vendorId,
      screeningquestions,
    };

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
    console.log(">>>>> the value  of the SURVEY ID is : ", surveyId);

    const survey = await prisma.survey.findFirst({
      where: { id: surveyId },
    });
    console.log(">>>>> the value  of the SURVEY is : ", survey);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: { quota_options: true, quota_buckets: true },
    });
    console.log(">>>>> the value  of the QUOTA is : ", quota);
    if (!quota) return res.status(404).json({ message: "Quota not found" });

    // NEW: merge + dedupe questionIds from both sources
    const questionIds = Array.from(
      new Set([
        ...quota.quota_options.map((o) => o.screeningQuestionId),
        ...quota.quota_buckets.map((b) => b.screeningQuestionId),
      ])
    );

    const questions = await prisma.screeningQuestionDefinition.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        question_text: true,
        question_type: true,
        vendor_question_id: true,
        data_type: true,
        options: {
          select: {
            id: true,
            option_text: true,
            vendor_option_id: true,
            order_index: true,
          },
        },
      },
    });
    console.log(">>>>> the value  of the QUESTIONS is : ", questions);

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
  return prisma.$transaction(async (tx) => {
    const r = await tx.quotaRespondent.create({
      data: { surveyQuotaId: quotaId, vendor_respondent_id: vendorId, status },
    });

    await tx.surveyQuota.update({
      where: { id: quotaId },
      data: full
        ? { quota_full_count: { increment: 1 } }
        : { terminated_count: { increment: 1 } },
    });

    return r;
  });
}

function matchBucket(bucket, answerValue) {
  const op = bucket.operator;
  const v = bucket.value;

  if (op === "BETWEEN")
    return Number(answerValue) >= v.min && Number(answerValue) <= v.max;
  if (op === "IN") return Array.isArray(v) && v.includes(String(answerValue));
  if (op === "EQ") return String(answerValue) === String(v);
  if (op === "GTE") return Number(answerValue) >= Number(v);
  if (op === "LTE") return Number(answerValue) <= Number(v);
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
    console.log(">>>>> the value  of the SURVEY ID is : ", surveyId);

    const { vendor_respondent_id, screeningAnswers, shareToken } = req.body;
    console.log(">>>>> the value  of the REQUEST BODY is : ", req.body);

    const quota = await prisma.surveyQuota.findUnique({
      where: { surveyId },
      include: { quota_options: true, quota_buckets: true, survey: true },
    });

    if (!quota || !quota.survey) {
      return res.status(404).json({
        qualified: false,
        status: "QUOTA_OR_SURVEY_NOT_FOUND",
        message: "Quota or Survey not found",
      });
    }

    // console.log(">>>>> the value  of the QUOTA is : ", quota);
    if (!quota.is_active || quota.target_count <= 0) {
      const respondent = await failRespondent(
        quota.id,
        vendor_respondent_id,
        "TERMINATED"
      );

      if (quota.survey.survey_send_by == "VENDOR") {
        const shareTokenDetails = await prisma.shareToken.findUnique({
          where: { token_hash: shareToken },
        });
        await redirectVendorFunction(shareTokenDetails, "TERMINATED");
      }

      return res.status(404).json({
        qualified: false,
        status: "QUOTA_INACTIVE",
        message: "Quota is not active",
        respondent_id: respondent.id,
      });
    }
    if (quota.current_count >= quota.target_count) {
      const respondent = await failRespondent(
        quota.id,
        vendor_respondent_id,
        "QUOTA_FULL",
        true
      );

      if (quota.survey.survey_send_by == "VENDOR") {
        const shareTokenDetails = await prisma.shareToken.findUnique({
          where: { token_hash: shareToken },
        });
        await redirectVendorFunction(shareTokenDetails, "QUOTA_FULL");
      }

      return res.status(200).json({
        qualified: false,
        status: "QUOTA_FULL",
        message: "Quota is full",
        respondent_id: respondent.id,
      });
    }

    // Build option map
    const quotaOptionMap = new Map(
      quota.quota_options.map((o) => [
        `${o.screeningQuestionId}_${o.screeningOptionId}`,
        o,
      ])
    );

    const bucketsByQuestion = new Map();
    for (const b of quota.quota_buckets) {
      if (!bucketsByQuestion.has(b.screeningQuestionId))
        bucketsByQuestion.set(b.screeningQuestionId, []);
      bucketsByQuestion.get(b.screeningQuestionId).push(b);
    }

    const normalizedAnswers = [];

    // Evaluate rules without mutating
    for (const ans of screeningAnswers) {
      if (ans.screeningOptionId) {
        const key = `${ans.screeningQuestionId}_${ans.screeningOptionId}`;
        const qOpt = quotaOptionMap.get(key);

        if (!qOpt) {
          const respondent = await failRespondent(
            quota.id,
            vendor_respondent_id,
            "TERMINATED"
          );

          if (quota.survey.survey_send_by == "VENDOR") {
            const shareTokenDetails = await prisma.shareToken.findUnique({
              where: { token_hash: shareToken },
            });
            await redirectVendorFunction(shareTokenDetails, "TERMINATED");
          }

          return res.status(200).json({
            qualified: false,
            status: "OPTION_NOT_ALLOWED",
            message: "Screening disqualified",
            respondent_id: respondent.id,
          });
        }

        if (qOpt.current_count >= qOpt.target_count) {
          const respondent = await failRespondent(
            quota.id,
            vendor_respondent_id,
            "QUOTA_FULL",
            true
          );

          if (quota.survey.survey_send_by == "VENDOR") {
            const shareTokenDetails = await prisma.shareToken.findUnique({
              where: { token_hash: shareToken },
            });
            await redirectVendorFunction(shareTokenDetails, "QUOTA_FULL");
          }

          return res.status(200).json({
            qualified: false,
            status: "QUOTA_FULL",
            message: "Option quota full",
            respondent_id: respondent.id,
          });
        }

        normalizedAnswers.push(ans);
        continue;
      }

      const buckets = bucketsByQuestion.get(ans.screeningQuestionId) ?? [];
      const matched = buckets.find((b) => matchBucket(b, ans.answerValue));

      if (!matched) {
        const respondent = await failRespondent(
          quota.id,
          vendor_respondent_id,
          "TERMINATED"
        );

        if (quota.survey.survey_send_by == "VENDOR") {
          const shareTokenDetails = await prisma.shareToken.findUnique({
            where: { token_hash: shareToken },
          });
          await redirectVendorFunction(shareTokenDetails, "TERMINATED");
        }

        return res.status(200).json({
          qualified: false,
          status: "NO_BUCKET_MATCH",
          message: "Screening disqualified",
          respondent_id: respondent.id,
        });
      }

      if (matched.current_count >= matched.target_count) {
        const respondent = await failRespondent(
          quota.id,
          vendor_respondent_id,
          "QUOTA_FULL",
          true
        );

        if (quota.survey.survey_send_by == "VENDOR") {
          const shareTokenDetails = await prisma.shareToken.findUnique({
            where: { token_hash: shareToken },
          });
          await redirectVendorFunction(shareTokenDetails, "QUOTA_FULL");
        }

        return res.status(200).json({
          qualified: false,
          status: "QUOTA_FULL",
          message: "Open-ended bucket full",
          respondent_id: respondent.id,
        });
      }

      normalizedAnswers.push({ ...ans, matchedBucketId: matched.id });
    }

    // Commit qualification atomically
    const respondent = await prisma.$transaction(async (tx) => {
      const r = await tx.quotaRespondent.create({
        data: {
          surveyQuotaId: quota.id,
          vendor_respondent_id,
          answers: normalizedAnswers,
          status: "QUALIFIED",
        },
      });

      await tx.surveyQuota.update({
        where: { id: quota.id },
        data: { qualified_count: { increment: 1 } },
      });

      return r;
    });

    return res.status(200).json({
      qualified: true,
      status: "QUALIFIED",
      message: "Qualified",
      respondent_id: respondent.id,
    });
  } catch (error) {
    console.error("Check Respondent Quota Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const redirectVendorFunction = async (shareTokenDetails, type) => {
  try {
    const vendor_token =
      shareTokenDetails.vendor_respondent_id.split("_BR_")[0];
    console.log(">>>>> the value of the VENDOR TOKEN is : ", vendor_token);

    const redirectUrl =
      (type == "COMPLETED"
        ? process.env.INNOVATE_MR_SUCCESS_REDIRECT_URL
        : type == "QUOTA_FULL"
        ? process.env.INNOVATE_MR_QUOTA_FULL_REDIRECT_URL
        : process.env.INNOVATE_MR_TERMINATE_REDIRECT_URL) + vendor_token;

    console.log(">>>>> the value of the REDIRECT URL is : ", redirectUrl);

    const redirectResponse = await axios.get(redirectUrl);
    console.log(
      ">>>>> the value of the redirectResponse is : ",
      redirectResponse.data
    );
    return redirectResponse.data;
  } catch (error) {
    console.log("Error in redirectVendorFunction: ", error);
    return error;
  }
};

export const markRespondentCompleted_v2 = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { respondent_id, response_id, token } = req.body;

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

    const answers = Array.isArray(respondent.answers) ? respondent.answers : [];

    const optionPairs = answers
      .filter((a) => a.screeningQuestionId && a.screeningOptionId)
      .map((a) => ({
        screeningQuestionId: a.screeningQuestionId,
        screeningOptionId: a.screeningOptionId,
      }));

    const bucketIds = answers.map((a) => a.matchedBucketId).filter(Boolean);

    // Update respondent and quota counts in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update respondent status
      const updatedRespondent = await tx.quotaRespondent.update({
        where: { id: respondent_id },
        data: {
          status: "COMPLETED",
          responseId: response_id,
        },
      });

      // Update survey quota total
      await tx.surveyQuota.update({
        where: { id: respondent.surveyQuotaId },
        data: { current_count: { increment: 1 } },
      });

      if (optionPairs.length) {
        await tx.surveyQuotaOption.updateMany({
          where: {
            quotaId: respondent.surveyQuotaId,
            OR: optionPairs,
          },
          data: { current_count: { increment: 1 } },
        });
      }

      if (bucketIds.length) {
        await tx.surveyQuotaBucket.updateMany({
          where: {
            quotaId: respondent.surveyQuotaId,
            id: { in: bucketIds },
          },
          data: { current_count: { increment: 1 } },
        });
      }

      return updatedRespondent;
    });

    const shareTokenDetails = await prisma.shareToken.findUnique({
      where: { token_hash: token },
      include: { survey: true },
    });
    console.log(
      ">>>>>>> the value of the SHARE TOKEN DETAILS is : ",
      shareTokenDetails
    );
    if (!shareTokenDetails) {
      return res.status(404).json({ message: "Invalid Share Token" });
    }
    if (shareTokenDetails.survey.survey_send_by == "VENDOR") {
      await redirectVendorFunction(shareTokenDetails, "COMPLETED");
    }

    return res.json({
      message: "Respondent marked as completed",
      respondent: result,
    });
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
    console.log(
      ">>>>> the value of the QUERY in markRespondentTerminated_v2 is : ",
      req.query
    );

    const shareTokenDetails = await prisma.shareToken.findUnique({
      where: { token_hash: shareToken },
      include: { survey: true },
    });
    console.log(
      ">>>>>>> the value of the SHARE TOKEN DETAILS is : ",
      shareTokenDetails
    );
    if (!shareTokenDetails)
      return res.status(404).json({ message: "Invalid Share Token" });

    const respondent = await prisma.quotaRespondent.findUnique({
      where: { id: respondent_id },
      include: { surveyQuota: true },
    });
    console.log(
      ">>>>> the value of the RESPONDENT in markRespondentTerminated_v2 is : ",
      respondent
    );
    if (!respondent)
      return res.status(404).json({ message: "Respondent not found" });

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

    const result = await prisma.$transaction(async (tx) => {
      const updatedRespondent = await tx.quotaRespondent.update({
        where: { id: respondent_id },
        data: {
          status: "TERMINATED",
        },
      });

      await tx.surveyQuota.update({
        where: { id: respondent.surveyQuotaId },
        data: { terminated_count: { increment: 1 } },
      });

      return updatedRespondent;
    });
    console.log(
      ">>>>> the value of the RESULT in markRespondentTerminated_v2 is : ",
      result
    );

    // if SHARE TOKEN then have to redirect to the vendor Terminate URL
    if (shareTokenDetails.survey.survey_send_by == "VENDOR") {
      await redirectVendorFunction(shareTokenDetails, "TERMINATED");
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
