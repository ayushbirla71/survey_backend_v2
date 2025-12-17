import Joi from "joi";

/**
 * ✅ AUTH VALIDATIONS
 */
export const registerValidation = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  mobile_no: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .optional()
    .messages({
      "string.pattern.base": "Mobile number must be 10 digits",
    }),
  password: Joi.string().min(6).max(30).required(),
  role: Joi.string().valid("SYSTEM_ADMIN", "USER").optional(),
  theme: Joi.string().valid("LIGHT", "DARK").optional(),
});

export const loginValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// -------- SURVEY --------
export const createSurveyValidation = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).required(),
  flow_type: Joi.string().valid("STATIC", "INTERACTIVE", "GAME").optional(),
  survey_send_by: Joi.string()
    .valid("WHATSAPP", "EMAIL", "BOTH", "NONE", "AGENT")
    .optional(),
  settings: Joi.object({
    isAnonymous: Joi.boolean().optional(),
    showProgressBar: Joi.boolean().optional(),
    shuffleQuestions: Joi.boolean().optional(),
    isResultPublic: Joi.boolean().optional(),
    autoReloadOnSubmit: Joi.boolean().optional(),
    requireTermsAndConditions: Joi.boolean().optional(),
  }).optional(),
  status: Joi.string().valid("DRAFT", "SCHEDULED", "PUBLISHED").optional(),
  scheduled_date: Joi.date().optional(),
  scheduled_type: Joi.string().valid("IMMEDIATE", "SCHEDULED").optional(),
  // New fields for AI generation
  surveyCategoryId: Joi.string().max(100).required(),
  autoGenerateQuestions: Joi.boolean().optional(),
});

export const updateSurveyValidation = Joi.object({
  title: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  flow_type: Joi.string().valid("STATIC", "INTERACTIVE", "GAME").optional(),
  survey_send_by: Joi.string()
    .valid("WHATSAPP", "EMAIL", "BOTH", "NONE", "AGENT")
    .optional(),
  settings: Joi.object({
    isAnonymous: Joi.boolean().optional(),
    showProgressBar: Joi.boolean().optional(),
    shuffleQuestions: Joi.boolean().optional(),
    isResultPublic: Joi.boolean().optional(),
    autoReloadOnSubmit: Joi.boolean().optional(),
    requireTermsAndConditions: Joi.boolean().optional(),
  }).optional(),
  status: Joi.string().valid("DRAFT", "SCHEDULED", "PUBLISHED").optional(),
  scheduled_date: Joi.date().optional(),
  scheduled_type: Joi.string().valid("IMMEDIATE", "SCHEDULED").optional(),
  // New fields for AI generation
  categoryOfSurvey: Joi.string().max(100).optional(),
  autoGenerateQuestions: Joi.boolean().optional(),
});

// -------- QUESTIONS --------
export const createQuestionValidation = Joi.object({
  surveyId: Joi.string().uuid().required(),
  question_type: Joi.string()
    .valid("TEXT", "IMAGE", "VIDEO", "AUDIO")
    .required(),
  question_text: Joi.string().min(1).max(500).required(),
  // options: Joi.array().items(Joi.string()).required(),
  options: Joi.array().optional(),
  rowOptions: Joi.array().optional(),
  columnOptions: Joi.array().optional(),
  mediaId: Joi.string().uuid().optional(),
  categoryId: Joi.string().uuid().required(),
  // subCategoryId: Joi.string().uuid().required(),
  order_index: Joi.number().integer().optional(),
  required: Joi.boolean().optional(),
  max_rank_allowed: Joi.number().integer().min(1).max(30).optional(),
  min_rank_required: Joi.number().integer().min(1).max(20).optional(),
  allow_partial_rank: Joi.boolean().optional(),
});

export const updateQuestionValidation = Joi.object({
  question_type: Joi.string()
    .valid("TEXT", "MCQ", "RATING", "IMAGE", "VIDEO", "AUDIO", "FILE", "MATRIX")
    .optional(),
  question_text: Joi.string().min(1).max(500).optional(),
  options: Joi.array().optional(),
  rowOptions: Joi.array().optional(),
  columnOptions: Joi.array().optional(),
  mediaId: Joi.string().uuid().allow(null).optional(),
  categoryId: Joi.string().uuid().optional(),
  // subCategoryId: Joi.string().uuid().optional(),
  order_index: Joi.number().integer().optional(),
  required: Joi.boolean().optional(),
  max_rank_allowed: Joi.number().integer().min(1).max(30).optional(),
  min_rank_required: Joi.number().integer().min(1).max(20).optional(),
  allow_partial_rank: Joi.boolean().optional(),
});

// -------- RESPONSES --------
export const createResponseValidation = Joi.object({
  surveyId: Joi.string().uuid().required(),
  user_metadata: Joi.object().optional(),
  answers: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().uuid().required(),
        // answer_type: Joi.string().required(),
        answer_value: Joi.alternatives()
          .try(Joi.string().allow(null, ""), Joi.number(), Joi.array())
          .allow(null, ""), // explicitly allow null or empty string
        media: Joi.array()
          .items(Joi.object({ type: Joi.string(), url: Joi.string() }))
          .optional(),
      })
    )
    .required(),
});

export const createResponseWithTokenValidation = Joi.object({
  token: Joi.string().required(),
  user_metadata: Joi.object().optional(),
  answers: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().uuid().required(),
        // answer_type: Joi.string().required(),
        answer_value: Joi.alternatives()
          .try(Joi.string().allow(null, ""), Joi.number(), Joi.array())
          .allow(null, ""), // explicitly allow null or empty string
        media: Joi.array()
          .items(Joi.object({ type: Joi.string(), url: Joi.string() }))
          .optional(),
      })
    )
    .required(),
});

// -------- AI GENERATED QUESTIONS --------
export const createAIGeneratedQuestionValidation = Joi.object({
  surveyId: Joi.string().uuid().required(),
  question_type: Joi.string()
    .valid("TEXT", "MCQ", "RATING", "IMAGE", "VIDEO", "AUDIO", "FILE", "MATRIX")
    .required(),
  question_text: Joi.string().min(1).max(500).required(),
  options: Joi.array().items(Joi.string()).optional(),
  order_index: Joi.number().integer().optional(),
  required: Joi.boolean().optional(),
  ai_prompt: Joi.string().optional(),
  ai_model: Joi.string().optional(),
  confidence_score: Joi.number().min(0).max(1).optional(),
});

export const updateAIGeneratedQuestionValidation = Joi.object({
  question_type: Joi.string()
    .valid("TEXT", "MCQ", "RATING", "IMAGE", "VIDEO", "AUDIO", "FILE", "MATRIX")
    .optional(),
  question_text: Joi.string().min(1).max(500).optional(),
  options: Joi.array().items(Joi.string()).optional(),
  order_index: Joi.number().integer().optional(),
  required: Joi.boolean().optional(),
  is_approved: Joi.boolean().optional(),
  is_added_to_survey: Joi.boolean().optional(),
});

export const approveAIQuestionValidation = Joi.object({
  questionIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

// -------- SHARE --------
export const shareSurveyValidation = Joi.object({
  surveyId: Joi.string().uuid().required(),
  type: Joi.string()
    .valid("NONE", "AGENT", "WHATSAPP", "EMAIL", "BOTH")
    .required(),
  recipients: Joi.array()
    .items(
      Joi.object({
        email: Joi.string().email().optional(),
        mobile_no: Joi.string()
          .pattern(/^[0-9]{10}$/)
          .optional(),
      })
    )
    .when("type", {
      is: Joi.valid("WHATSAPP", "EMAIL", "BOTH"),
      then: Joi.required().messages({
        "any.required":
          "Recipients are required when type is WHATSAPP, EMAIL, or BOTH",
      }),
      otherwise: Joi.optional(),
    }),
  agentUserUniqueIds: Joi.array()
    .items(Joi.string())
    .when("type", {
      is: "AGENT",
      then: Joi.required().messages({
        "any.required": "Agent User Unique IDs are required when type is AGENT",
      }),
      otherwise: Joi.optional(),
    }),
});

// -------- ANALYTICS --------
export const surveyAnalyticsValidation = Joi.object({
  surveyId: Joi.string().uuid().required(),
});

export const questionAnalyticsValidation = Joi.object({
  surveyId: Joi.string().uuid().required(),
  questionId: Joi.string().uuid().optional(), // if omitted, return all questions analytics
});
