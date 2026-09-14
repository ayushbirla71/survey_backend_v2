import { DataTypes } from "sequelize";
import sequelize from "../db/connectDB.js";

const defaultTimestamps = {
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
};

// 1. User Model
export const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    mobile_no: { type: DataTypes.STRING, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM({ name: "Role", values: ["SYSTEM_ADMIN", "USER"] }),
      allowNull: false,
      defaultValue: "USER",
    },
    theme: { type: DataTypes.STRING, defaultValue: "LIGHT" },
    is_blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    ...defaultTimestamps,
  },
  { tableName: "User", timestamps: false }
);

// 2. Survey Category Model
export const SurveyCategory = sequelize.define(
  "SurveyCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
  },
  { tableName: "SurveyCategory", timestamps: false }
);

// 3. Survey Model
export const Survey = sequelize.define(
  "Survey",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    no_of_questions: { type: DataTypes.INTEGER, defaultValue: 0 },
    userId: { type: DataTypes.UUID, allowNull: false },
    survey_send_by: {
      type: DataTypes.ENUM({
        name: "SurveySendBy",
        values: ["WHATSAPP", "EMAIL", "BOTH", "NONE", "AGENT", "VENDOR"],
      }),
      defaultValue: "NONE",
    },
    flow_type: {
      type: DataTypes.ENUM({
        name: "FlowType",
        values: ["STATIC", "INTERACTIVE", "GAME"],
      }),
      defaultValue: "STATIC",
    },
    settings: { type: DataTypes.JSONB, defaultValue: {} },
    status: {
      type: DataTypes.ENUM({
        name: "SurveyStatus",
        values: ["DRAFT", "SCHEDULED", "PUBLISHED"],
      }),
      defaultValue: "DRAFT",
    },
    scheduled_date: { type: DataTypes.DATE },
    scheduled_type: {
      type: DataTypes.ENUM({
        name: "ScheduleType",
        values: ["IMMEDIATE", "SCHEDULED"],
      }),
      defaultValue: "IMMEDIATE",
    },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    surveyCategoryId: { type: DataTypes.UUID },
    autoGenerateQuestions: { type: DataTypes.BOOLEAN, defaultValue: false },
    ...defaultTimestamps,
  },
  { tableName: "Survey", timestamps: false }
);

// 4. Question Category Model
export const QuestionCategory = sequelize.define(
  "QuestionCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type_name: { type: DataTypes.STRING, allowNull: false, unique: true },
    settings: { type: DataTypes.JSONB, defaultValue: {} },
  },
  { tableName: "QuestionCategory", timestamps: false }
);

// 5. Media Asset Model
export const MediaAsset = sequelize.define(
  "MediaAsset",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM({
        name: "MediaType",
        values: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
      }),
      allowNull: false,
    },
    url: { type: DataTypes.STRING, allowNull: false },
    thumbnail_url: { type: DataTypes.STRING },
    uploaded_by: { type: DataTypes.STRING, defaultValue: "Anonymous" },
    meta: { type: DataTypes.JSONB, defaultValue: {} },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "MediaAsset", timestamps: false }
);

// 6. Question Model
export const Question = sequelize.define(
  "Question",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false },
    question_type: {
      type: DataTypes.ENUM({
        name: "QuestionType",
        values: ["TEXT", "IMAGE", "VIDEO", "AUDIO"],
      }),
      allowNull: false,
    },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    mediaId: { type: DataTypes.UUID },
    order_index: { type: DataTypes.INTEGER, defaultValue: 0 },
    required: { type: DataTypes.BOOLEAN, defaultValue: true },
    categoryId: { type: DataTypes.UUID },
    max_rank_allowed: { type: DataTypes.INTEGER },
    min_rank_required: { type: DataTypes.INTEGER },
    allow_partial_rank: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "Question", timestamps: false }
);

// 7. Option Model
export const Option = sequelize.define(
  "Option",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    text: { type: DataTypes.TEXT },
    mediaId: { type: DataTypes.UUID, unique: true },
    questionId: { type: DataTypes.UUID, allowNull: false },
    rowQuestionOptionId: { type: DataTypes.UUID },
    columnQuestionOptionId: { type: DataTypes.UUID },
    rangeFrom: { type: DataTypes.INTEGER },
    rangeTo: { type: DataTypes.INTEGER },
    fromLabel: { type: DataTypes.STRING },
    toLabel: { type: DataTypes.STRING },
    icon: { type: DataTypes.STRING },
  },
  { tableName: "Option", timestamps: false }
);

// 8. Response Model
export const Response = sequelize.define(
  "Response",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false },
    user_metadata: { type: DataTypes.JSONB, defaultValue: {} },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "Response", timestamps: false }
);

// 9. ResponseAnswer Model
export const ResponseAnswer = sequelize.define(
  "ResponseAnswer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    responseId: { type: DataTypes.UUID, allowNull: false },
    questionId: { type: DataTypes.UUID, allowNull: false },
    answer_value: { type: DataTypes.TEXT },
    mediaId: { type: DataTypes.UUID },
    selected_option_ids: { type: DataTypes.JSONB },
    scaleRatingValue: { type: DataTypes.INTEGER },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "ResponseAnswer", timestamps: false }
);

// 10. GridResponseAnswer Model
export const GridResponseAnswer = sequelize.define(
  "GridResponseAnswer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    responseAnswerId: { type: DataTypes.UUID, allowNull: false },
    rowOptionId: { type: DataTypes.UUID, allowNull: false },
    columnOptionId: { type: DataTypes.UUID, allowNull: false },
    selected: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: "GridResponseAnswer", timestamps: false }
);

// 11. RankingResponseAnswer Model
export const RankingResponseAnswer = sequelize.define(
  "RankingResponseAnswer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    responseAnswerId: { type: DataTypes.UUID, allowNull: false },
    optionId: { type: DataTypes.UUID, allowNull: false },
    rank_position: { type: DataTypes.INTEGER, allowNull: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "RankingResponseAnswer", timestamps: false }
);

// 12. ShareToken Model
export const ShareToken = sequelize.define(
  "ShareToken",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false },
    recipient_email: { type: DataTypes.STRING },
    recipient_mobile: { type: DataTypes.STRING },
    agentUserUniqueId: { type: DataTypes.STRING },
    vendor_respondent_id: { type: DataTypes.STRING },
    token_hash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE },
    used: { type: DataTypes.BOOLEAN, defaultValue: false },
    isTest: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "ShareToken", timestamps: false }
);

// 13. MasterAudience Model
export const MasterAudience = sequelize.define(
  "MasterAudience",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    mobile_no: { type: DataTypes.STRING },
    attributes: { type: DataTypes.JSONB, defaultValue: {} },
  },
  { tableName: "MasterAudience", timestamps: false }
);

// 14. SurveyAudience Model
export const SurveyAudience = sequelize.define(
  "SurveyAudience",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    mobile_no: { type: DataTypes.STRING },
    attributes: { type: DataTypes.JSONB, defaultValue: {} },
    ...defaultTimestamps,
  },
  { tableName: "SurveyAudience", timestamps: false }
);

// 15. AIGeneratedQuestion Model
export const AIGeneratedQuestion = sequelize.define(
  "AIGeneratedQuestion",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false },
    question_type: {
      type: DataTypes.ENUM({
        name: "QuestionType",
        values: ["TEXT", "IMAGE", "VIDEO", "AUDIO"],
      }),
      allowNull: false,
    },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    options: { type: DataTypes.JSONB, defaultValue: [] },
    order_index: { type: DataTypes.INTEGER, defaultValue: 0 },
    required: { type: DataTypes.BOOLEAN, defaultValue: true },
    categoryId: { type: DataTypes.UUID, allowNull: false },
    ai_prompt: { type: DataTypes.TEXT },
    ai_model: { type: DataTypes.STRING },
    confidence_score: { type: DataTypes.FLOAT },
    is_approved: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_added_to_survey: { type: DataTypes.BOOLEAN, defaultValue: false },
    ...defaultTimestamps,
  },
  { tableName: "AIGeneratedQuestion", timestamps: false }
);

// 16. ScreeningQuestion Model
export const ScreeningQuestion = sequelize.define(
  "ScreeningQuestion",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyQuotaId: { type: DataTypes.UUID, allowNull: false },
    question_id: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.ENUM({
        name: "ScreeningQuestionType",
        values: ["AGE", "GENDER", "LOCATION", "CATEGORY", "CUSTOM"],
      }),
      allowNull: false,
    },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    required: { type: DataTypes.BOOLEAN, defaultValue: true },
    order_index: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "ScreeningQuestion", timestamps: false }
);

// 17. ScreeningQuestionOption Model
export const ScreeningQuestionOption = sequelize.define(
  "ScreeningQuestionOption",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    screeningQuestionId: { type: DataTypes.UUID, allowNull: false },
    option_id: { type: DataTypes.STRING, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false },
    order_index: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "ScreeningQuestionOption", timestamps: false }
);

// 18. Vendor Model
export const Vendor = sequelize.define(
  "Vendor",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.ENUM({
        name: "VendorKey",
        values: ["INNOVATEMR", "INNOVATEMR_TEST", "SURVEY96"],
      }),
      allowNull: false,
      unique: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "Vendor", timestamps: false }
);

// 19. VendorApiConfig Model
export const VendorApiConfig = sequelize.define(
  "VendorApiConfig",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    api_version: { type: DataTypes.STRING, allowNull: false },
    base_url: { type: DataTypes.STRING, allowNull: false },
    auth_type: {
      type: DataTypes.ENUM({
        name: "VendorAuthType",
        values: ["API_KEY", "BASIC", "OAUTH2", "CUSTOM"],
      }),
      allowNull: false,
    },
    credentials: { type: DataTypes.JSONB, allowNull: false },
    is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "VendorApiConfig", timestamps: false }
);

// 20. SurveyVendorConfig Model
export const SurveyVendorConfig = sequelize.define(
  "SurveyVendorConfig",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false, unique: true },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    api_config_id: { type: DataTypes.UUID, allowNull: false },
    vendor_survey_id: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM({
        name: "VendorSurveyStatus",
        values: ["CREATED", "LIVE", "PAUSED", "CLOSED"],
      }),
      allowNull: false,
    },
    vendor_group_id: { type: DataTypes.STRING },
    is_target_added: { type: DataTypes.BOOLEAN, defaultValue: false },
    vendor_quota_id: { type: DataTypes.STRING },
    quota_cost: { type: DataTypes.INTEGER },
    is_cost_accepted: { type: DataTypes.BOOLEAN, defaultValue: false },
    ...defaultTimestamps,
  },
  { tableName: "SurveyVendorConfig", timestamps: false }
);

// 21. VendorQuestionLibrary Model
export const VendorQuestionLibrary = sequelize.define(
  "VendorQuestionLibrary",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    api_config_id: { type: DataTypes.UUID },
    country_code: { type: DataTypes.STRING, allowNull: false },
    language: { type: DataTypes.STRING, allowNull: false },
    question_key: { type: DataTypes.STRING, allowNull: false },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    question_type: { type: DataTypes.STRING, allowNull: false },
    vendor_question_id: { type: DataTypes.STRING },
    metadata: { type: DataTypes.JSONB },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "VendorQuestionLibrary", timestamps: false }
);

// 22. VendorQuestionOption Model
export const VendorQuestionOption = sequelize.define(
  "VendorQuestionOption",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    questionId: { type: DataTypes.UUID, allowNull: false },
    option_text: { type: DataTypes.STRING, allowNull: false },
    vendor_option_id: { type: DataTypes.STRING },
    order_index: { type: DataTypes.INTEGER },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "VendorQuestionOption", timestamps: false }
);

// 23. VendorQuestionCategory Model
export const VendorQuestionCategory = sequelize.define(
  "VendorQuestionCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    questionId: { type: DataTypes.UUID, allowNull: false },
    vendor_category_id: { type: DataTypes.STRING, allowNull: false },
    category_name: { type: DataTypes.STRING, allowNull: false },
    is_primary: { type: DataTypes.BOOLEAN, defaultValue: false },
    order_index: { type: DataTypes.INTEGER },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "VendorQuestionCategory", timestamps: false }
);

// 24. ScreeningQuestionDefinition Model
export const ScreeningQuestionDefinition = sequelize.define(
  "ScreeningQuestionDefinition",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    country_code: { type: DataTypes.STRING, defaultValue: "IN" },
    language: { type: DataTypes.STRING, defaultValue: "ENGLISH" },
    question_key: { type: DataTypes.STRING, allowNull: false },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    question_type: { type: DataTypes.STRING, allowNull: false },
    data_type: {
      type: DataTypes.ENUM({
        name: "DataType",
        values: ["STRING", "NUMBER", "ARRAY"],
      }),
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM({
        name: "QuestionSource",
        values: ["VENDOR", "SYSTEM", "CUSTOM"],
      }),
      allowNull: false,
    },
    vendorId: { type: DataTypes.UUID },
    vendor_question_id: { type: DataTypes.STRING },
    primary_vendor_category_id: { type: DataTypes.STRING },
    primary_vendor_category_name: { type: DataTypes.STRING },
    categories_meta: { type: DataTypes.JSONB },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "ScreeningQuestionDefinition", timestamps: false }
);

// 25. ScreenQuestionOption Model
export const ScreenQuestionOption = sequelize.define(
  "ScreenQuestionOption",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    screeningQuestionId: { type: DataTypes.UUID, allowNull: false },
    option_text: { type: DataTypes.STRING, allowNull: false },
    vendor_option_id: { type: DataTypes.STRING },
    order_index: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: "ScreenQuestionOption", timestamps: false }
);

// 26. SurveyQuestionConfig Model
export const SurveyQuestionConfig = sequelize.define(
  "SurveyQuestionConfig",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false },
    screeningQuestionId: { type: DataTypes.UUID, allowNull: false },
    is_required: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_screening: { type: DataTypes.BOOLEAN, defaultValue: true },
    terminate_on: { type: DataTypes.JSONB },
    qualify_on: { type: DataTypes.JSONB },
    order_index: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: "SurveyQuestionConfig", timestamps: false }
);

// 27. SurveyQuota Model
export const SurveyQuota = sequelize.define(
  "SurveyQuota",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyId: { type: DataTypes.UUID, allowNull: false, unique: true },
    target_count: { type: DataTypes.INTEGER },
    target_percentage: { type: DataTypes.FLOAT },
    current_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    qualified_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    terminated_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    quota_full_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    vendorId: { type: DataTypes.STRING },
    country_code: { type: DataTypes.STRING, defaultValue: "IN" },
    language: { type: DataTypes.STRING, defaultValue: "ENGLISH" },
    ...defaultTimestamps,
  },
  { tableName: "SurveyQuota", timestamps: false }
);

// 28. SurveyQuotaOption Model
export const SurveyQuotaOption = sequelize.define(
  "SurveyQuotaOption",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    quotaId: { type: DataTypes.UUID, allowNull: false },
    screeningQuestionId: { type: DataTypes.UUID, allowNull: false },
    screeningOptionId: { type: DataTypes.UUID, allowNull: false },
    target_count: { type: DataTypes.INTEGER, allowNull: false },
    current_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    ...defaultTimestamps,
  },
  { tableName: "SurveyQuotaOption", timestamps: false }
);

// 29. SurveyQuotaBucket Model
export const SurveyQuotaBucket = sequelize.define(
  "SurveyQuotaBucket",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    quotaId: { type: DataTypes.UUID, allowNull: false },
    screeningQuestionId: { type: DataTypes.UUID, allowNull: false },
    label: { type: DataTypes.STRING },
    operator: {
      type: DataTypes.ENUM({
        name: "QuotaOperator",
        values: ["BETWEEN", "GREATER_THAN", "LESS_THAN", "EQUALS"],
      }),
      allowNull: false,
    },
    value: { type: DataTypes.JSONB, allowNull: false },
    target_count: { type: DataTypes.INTEGER, allowNull: false },
    current_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    ...defaultTimestamps,
  },
  { tableName: "SurveyQuotaBucket", timestamps: false }
);

// 30. QuotaRespondent Model
export const QuotaRespondent = sequelize.define(
  "QuotaRespondent",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    surveyQuotaId: { type: DataTypes.UUID, allowNull: false },
    answers: { type: DataTypes.JSONB },
    vendor_respondent_id: { type: DataTypes.STRING },
    age: { type: DataTypes.INTEGER },
    gender: {
      type: DataTypes.ENUM({
        name: "Gender",
        values: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
      }),
    },
    country: { type: DataTypes.STRING },
    state: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    surveyCategoryId: { type: DataTypes.STRING },
    status: {
      type: DataTypes.ENUM({
        name: "RespondentStatus",
        values: ["QUALIFIED", "COMPLETED", "TERMINATED", "QUOTA_FULL"],
      }),
      defaultValue: "QUALIFIED",
    },
    redirect_url_called: { type: DataTypes.STRING },
    redirect_called_at: { type: DataTypes.DATE },
    responseId: { type: DataTypes.UUID, unique: true },
    ...defaultTimestamps,
  },
  { tableName: "QuotaRespondent", timestamps: false }
);

/////////////////////////////////////////////////
// ASSOCIATIONS / RELATIONS
/////////////////////////////////////////////////

// User & Survey
User.hasMany(Survey, { foreignKey: "userId", as: "surveys" });
Survey.belongsTo(User, { foreignKey: "userId", as: "user" });

// Survey & SurveyCategory
SurveyCategory.hasMany(Survey, { foreignKey: "surveyCategoryId", as: "surveys" });
Survey.belongsTo(SurveyCategory, {
  foreignKey: "surveyCategoryId",
  as: "surveyCategory",
});

// Survey & Question
Survey.hasMany(Question, { foreignKey: "surveyId", as: "questions" });
Question.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

// Question & QuestionCategory
QuestionCategory.hasMany(Question, { foreignKey: "categoryId", as: "questions" });
Question.belongsTo(QuestionCategory, {
  foreignKey: "categoryId",
  as: "category",
});

// MediaAsset & Question / Option / ResponseAnswer
MediaAsset.hasMany(Question, { foreignKey: "mediaId", as: "questions" });
Question.belongsTo(MediaAsset, { foreignKey: "mediaId", as: "mediaAsset" });

MediaAsset.hasOne(Option, { foreignKey: "mediaId", as: "options" });
Option.belongsTo(MediaAsset, { foreignKey: "mediaId", as: "mediaAsset" });

MediaAsset.hasMany(ResponseAnswer, { foreignKey: "mediaId", as: "responseAnswer" });
ResponseAnswer.belongsTo(MediaAsset, { foreignKey: "mediaId", as: "mediaAsset" });

// Question & Option
Question.hasMany(Option, { foreignKey: "questionId", as: "options" });
Option.belongsTo(Question, { foreignKey: "questionId", as: "question" });

Question.hasMany(Option, {
  foreignKey: "rowQuestionOptionId",
  as: "rowOptions",
});
Option.belongsTo(Question, {
  foreignKey: "rowQuestionOptionId",
  as: "rowQuestionOptions",
});

Question.hasMany(Option, {
  foreignKey: "columnQuestionOptionId",
  as: "columnOptions",
});
Option.belongsTo(Question, {
  foreignKey: "columnQuestionOptionId",
  as: "columnQuestionOptions",
});

// Survey & Response
Survey.hasMany(Response, { foreignKey: "surveyId", as: "responses" });
Response.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

// Response & ResponseAnswer
Response.hasMany(ResponseAnswer, {
  foreignKey: "responseId",
  as: "response_answers",
});
ResponseAnswer.belongsTo(Response, { foreignKey: "responseId", as: "response" });

Question.hasMany(ResponseAnswer, {
  foreignKey: "questionId",
  as: "response_answers",
});
ResponseAnswer.belongsTo(Question, { foreignKey: "questionId", as: "question" });

// ResponseAnswer & GridResponseAnswer / RankingResponseAnswer
ResponseAnswer.hasMany(GridResponseAnswer, {
  foreignKey: "responseAnswerId",
  as: "grid_answers",
});
GridResponseAnswer.belongsTo(ResponseAnswer, {
  foreignKey: "responseAnswerId",
  as: "responseAnswer",
});

ResponseAnswer.hasMany(RankingResponseAnswer, {
  foreignKey: "responseAnswerId",
  as: "ranking_answers",
});
RankingResponseAnswer.belongsTo(ResponseAnswer, {
  foreignKey: "responseAnswerId",
  as: "responseAnswer",
});

Option.hasMany(RankingResponseAnswer, {
  foreignKey: "optionId",
  as: "ranking_answers",
});
RankingResponseAnswer.belongsTo(Option, { foreignKey: "optionId", as: "option" });

// ShareToken
Survey.hasMany(ShareToken, { foreignKey: "surveyId", as: "share_tokens" });
ShareToken.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

// SurveyAudience
Survey.hasMany(SurveyAudience, { foreignKey: "surveyId", as: "audiences" });
SurveyAudience.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

// AIGeneratedQuestion
Survey.hasMany(AIGeneratedQuestion, {
  foreignKey: "surveyId",
  as: "ai_generated_questions",
});
AIGeneratedQuestion.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

// Vendor Relations
Vendor.hasMany(VendorApiConfig, { foreignKey: "vendorId", as: "api_configs" });
VendorApiConfig.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendor" });

Vendor.hasMany(SurveyVendorConfig, {
  foreignKey: "vendorId",
  as: "survey_vendor_configs",
});
SurveyVendorConfig.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendor" });

VendorApiConfig.hasMany(SurveyVendorConfig, {
  foreignKey: "api_config_id",
  as: "survey_vendor_configs",
});
SurveyVendorConfig.belongsTo(VendorApiConfig, {
  foreignKey: "api_config_id",
  as: "api_config",
});

Survey.hasOne(SurveyVendorConfig, { foreignKey: "surveyId", as: "vendorConfig" });
SurveyVendorConfig.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

VendorApiConfig.hasMany(VendorQuestionLibrary, {
  foreignKey: "api_config_id",
  as: "vendor_question_library",
});
VendorQuestionLibrary.belongsTo(VendorApiConfig, {
  foreignKey: "api_config_id",
  as: "api_config",
});

VendorQuestionLibrary.hasMany(VendorQuestionOption, {
  foreignKey: "questionId",
  as: "options",
});
VendorQuestionOption.belongsTo(VendorQuestionLibrary, {
  foreignKey: "questionId",
  as: "question",
});

VendorQuestionLibrary.hasMany(VendorQuestionCategory, {
  foreignKey: "questionId",
  as: "category",
});
VendorQuestionCategory.belongsTo(VendorQuestionLibrary, {
  foreignKey: "questionId",
  as: "vendor_question_library",
});

Vendor.hasMany(VendorQuestionLibrary, {
  foreignKey: "vendorId",
  as: "question_library",
});
VendorQuestionLibrary.belongsTo(Vendor, {
  foreignKey: "vendorId",
  as: "vendor",
});

Vendor.hasMany(VendorQuestionLibrary, {
  foreignKey: "vendorId",
  as: "vendor_question_library",
});

// Screening Questions
Vendor.hasMany(ScreeningQuestionDefinition, {
  foreignKey: "vendorId",
  as: "screening_question_definitions",
});
ScreeningQuestionDefinition.belongsTo(Vendor, {
  foreignKey: "vendorId",
  as: "vendor",
});

ScreeningQuestionDefinition.hasMany(ScreenQuestionOption, {
  foreignKey: "screeningQuestionId",
  as: "options",
});
ScreenQuestionOption.belongsTo(ScreeningQuestionDefinition, {
  foreignKey: "screeningQuestionId",
  as: "screeningQuestion",
});

Survey.hasMany(SurveyQuestionConfig, {
  foreignKey: "surveyId",
  as: "survey_question_configs",
});
SurveyQuestionConfig.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

ScreeningQuestionDefinition.hasMany(SurveyQuestionConfig, {
  foreignKey: "screeningQuestionId",
  as: "survey_question_configs",
});
SurveyQuestionConfig.belongsTo(ScreeningQuestionDefinition, {
  foreignKey: "screeningQuestionId",
  as: "screeningQuestion",
});

// Quotas
Survey.hasOne(SurveyQuota, { foreignKey: "surveyId", as: "quota" });
SurveyQuota.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });

SurveyQuota.hasMany(ScreeningQuestion, {
  foreignKey: "surveyQuotaId",
  as: "screening_questions",
});
ScreeningQuestion.belongsTo(SurveyQuota, {
  foreignKey: "surveyQuotaId",
  as: "surveyQuota",
});

ScreeningQuestion.hasMany(ScreeningQuestionOption, {
  foreignKey: "screeningQuestionId",
  as: "options",
});
ScreeningQuestionOption.belongsTo(ScreeningQuestion, {
  foreignKey: "screeningQuestionId",
  as: "screeningQuestion",
});

SurveyQuota.hasMany(SurveyQuotaOption, {
  foreignKey: "quotaId",
  as: "quota_options",
});
SurveyQuotaOption.belongsTo(SurveyQuota, {
  foreignKey: "quotaId",
  as: "quota",
});

ScreeningQuestionDefinition.hasMany(SurveyQuotaOption, {
  foreignKey: "screeningQuestionId",
  as: "quota_options",
});
SurveyQuotaOption.belongsTo(ScreeningQuestionDefinition, {
  foreignKey: "screeningQuestionId",
  as: "screeningQuestion",
});

ScreenQuestionOption.hasMany(SurveyQuotaOption, {
  foreignKey: "screeningOptionId",
  as: "quota_options",
});
SurveyQuotaOption.belongsTo(ScreenQuestionOption, {
  foreignKey: "screeningOptionId",
  as: "screeningOption",
});

SurveyQuota.hasMany(SurveyQuotaBucket, {
  foreignKey: "quotaId",
  as: "quota_buckets",
});
SurveyQuotaBucket.belongsTo(SurveyQuota, {
  foreignKey: "quotaId",
  as: "quota",
});

ScreeningQuestionDefinition.hasMany(SurveyQuotaBucket, {
  foreignKey: "screeningQuestionId",
  as: "quota_buckets",
});
SurveyQuotaBucket.belongsTo(ScreeningQuestionDefinition, {
  foreignKey: "screeningQuestionId",
  as: "screeningQuestion",
});

SurveyQuota.hasMany(QuotaRespondent, {
  foreignKey: "surveyQuotaId",
  as: "respondents",
});
QuotaRespondent.belongsTo(SurveyQuota, {
  foreignKey: "surveyQuotaId",
  as: "surveyQuota",
});

export default sequelize;
