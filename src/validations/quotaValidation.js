import Joi from "joi";

/**
 * ✅ QUOTA CONFIGURATION VALIDATIONS
 */

// Screening Question Option Schema
const screeningQuestionOptionSchema = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  value: Joi.string().required(), // Can be simple value or JSON string for location
});

// Screening Question Schema
const screeningQuestionSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string()
    .valid("age", "gender", "location", "category", "custom")
    .required(),
  question_text: Joi.string().required(),
  options: Joi.array().items(screeningQuestionOptionSchema).min(1).required(),
  required: Joi.boolean().default(true),
});

// Age Quota Schema
const ageQuotaSchema = Joi.object({
  min_age: Joi.number().integer().min(0).max(120).required(),
  max_age: Joi.number().integer().min(Joi.ref("min_age")).max(120).required(),
  quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
  target_count: Joi.number().integer().min(1).when("quota_type", {
    is: "COUNT",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
    is: "PERCENTAGE",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

// Gender Quota Schema
const genderQuotaSchema = Joi.object({
  gender: Joi.string()
    .valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY")
    .required(),
  quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
  target_count: Joi.number().integer().min(1).when("quota_type", {
    is: "COUNT",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
    is: "PERCENTAGE",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

// Location Quota Schema
const locationQuotaSchema = Joi.object({
  country: Joi.string().optional(),
  state: Joi.string().optional(),
  city: Joi.string().optional(),
  postal_code: Joi.string().optional(),
  quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
  target_count: Joi.number().integer().min(1).when("quota_type", {
    is: "COUNT",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
    is: "PERCENTAGE",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
}).or("country", "state", "city", "postal_code");

// Category Quota Schema
const categoryQuotaSchema = Joi.object({
  surveyCategoryId: Joi.string().uuid().required(),
  quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
  target_count: Joi.number().integer().min(1).when("quota_type", {
    is: "COUNT",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
    is: "PERCENTAGE",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

// Main Quota Configuration Schema
export const quotaConfigValidation = Joi.object({
  total_target: Joi.number().integer().min(1).required(),
  completed_url: Joi.string().uri().allow("", null).optional(),
  terminated_url: Joi.string().uri().allow("", null).optional(),
  quota_full_url: Joi.string().uri().allow("", null).optional(),
  is_active: Joi.boolean().optional(),

  age_quotas: Joi.array().items(ageQuotaSchema).optional(),
  gender_quotas: Joi.array().items(genderQuotaSchema).optional(),
  location_quotas: Joi.array().items(locationQuotaSchema).optional(),
  category_quotas: Joi.array().items(categoryQuotaSchema).optional(),
  screening_questions: Joi.array().items(screeningQuestionSchema).optional(),
});

// Update Quota Configuration Schema (all fields optional)
export const updateQuotaConfigValidation = Joi.object({
  total_target: Joi.number().integer().min(1).optional(),
  completed_url: Joi.string().uri().allow("", null).optional(),
  terminated_url: Joi.string().uri().allow("", null).optional(),
  quota_full_url: Joi.string().uri().allow("", null).optional(),
  is_active: Joi.boolean().optional(),

  age_quotas: Joi.array().items(ageQuotaSchema).optional(),
  gender_quotas: Joi.array().items(genderQuotaSchema).optional(),
  location_quotas: Joi.array().items(locationQuotaSchema).optional(),
  category_quotas: Joi.array().items(categoryQuotaSchema).optional(),
  screening_questions: Joi.array().items(screeningQuestionSchema).optional(),
});

// Check Respondent Validation
export const checkRespondentValidation = Joi.object({
  vendor_respondent_id: Joi.string().required(),
  age: Joi.number().integer().min(0).max(120).optional(),
  gender: Joi.string()
    .valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY")
    .optional(),
  country: Joi.string().optional(),
  state: Joi.string().optional(),
  city: Joi.string().optional(),
  surveyCategoryId: Joi.string().uuid().optional(),
});

// Mark Respondent Complete/Terminate Validation
export const markRespondentValidation = Joi.object({
  respondent_id: Joi.string().uuid().required(),
  response_id: Joi.string().uuid().optional(),
});

// Terminate with reason
export const terminateRespondentValidation = Joi.object({
  respondent_id: Joi.string().uuid().required(),
  reason: Joi.string().optional(),
});
