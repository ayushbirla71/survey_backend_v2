import axios from "axios";
import sequelize, {
  VendorApiConfig,
  VendorQuestionLibrary,
  VendorQuestionCategory,
  VendorQuestionOption,
  ScreeningQuestionDefinition,
  ScreenQuestionOption,
} from "../models/index.js";

function hasInvalidCategory(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return true;

  return categories.some(
    (c) =>
      !c ||
      typeof c.Id === "undefined" ||
      typeof c.Name !== "string" ||
      c.Name.trim() === ""
  );
}

export async function ingestInnovateMRQuestions({
  vendorId,
  apiConfigId,
  countryCode,
  language,
}) {
  if (!vendorId || !apiConfigId || !countryCode || !language) {
    throw new Error(
      "vendorId, apiConfigId, countryCode, language are required"
    );
  }

  // 1️⃣ Fetch API config
  const apiConfig = await VendorApiConfig.findByPk(apiConfigId);
  if (!apiConfig || !apiConfig.is_active) {
    throw new Error("Invalid or inactive VendorApiConfig");
  }
  console.log(">>>>> the value of the API CONFIG is : ", apiConfig);

  // 2️⃣ Call InnovateMR API
  const response = await axios.get(
    `${apiConfig.base_url}/pega/questions/${countryCode}/${language}`,
    {
      headers: {
        "x-access-token": `${apiConfig.credentials.token}`,
      },
    }
  );
  console.log(
    ">>>>> the value of the RESPONSE from INNOVATE MR is : ",
    response.data
  );

  const questions = response.data?.Questions;
  if (!Array.isArray(questions)) {
    throw new Error("Invalid InnovateMR response format");
  }

  const BATCH_SIZE = 10;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    const transaction = await sequelize.transaction();
    try {
      for (const q of batch) {
        // Skip question if categories are invalid
        if (hasInvalidCategory(q.Category)) {
          console.warn(`[SKIPPED QUESTION] Invalid category data`, {
            questionKey: q.QuestionKey,
            categories: q.Category,
          });
          continue;
        }

        let question = await VendorQuestionLibrary.findOne({
          where: {
            vendorId,
            question_key: q.QuestionKey,
            country_code: countryCode,
            language,
          },
          transaction,
        });

        if (question) {
          await question.update(
            {
              question_text: q.QuestionText,
              question_type: q.QuestionType,
              vendor_question_id: String(q.Id),
              metadata: { standardTarget: q.StandardTarget },
              api_config_id: apiConfigId,
              is_active: true,
            },
            { transaction }
          );
        } else {
          question = await VendorQuestionLibrary.create(
            {
              vendorId,
              api_config_id: apiConfigId,
              country_code: countryCode,
              language,
              question_key: q.QuestionKey,
              question_text: q.QuestionText,
              question_type: q.QuestionType,
              vendor_question_id: String(q.Id),
              metadata: { standardTarget: q.StandardTarget },
              is_active: true,
            },
            { transaction }
          );
        }

        await VendorQuestionCategory.destroy({
          where: { questionId: question.id },
          transaction,
        });

        await VendorQuestionOption.destroy({
          where: { questionId: question.id },
          transaction,
        });

        await VendorQuestionCategory.bulkCreate(
          q.Category.map((c, index) => ({
            questionId: question.id,
            vendor_category_id: String(c.Id),
            category_name: c.Name.trim(),
            is_primary: Boolean(c.Primary),
            order_index: index,
          })),
          { transaction }
        );

        if (Array.isArray(q.Options) && q.Options.length > 0) {
          await VendorQuestionOption.bulkCreate(
            q.Options.filter((o) => o && o.OptionText).map((o, index) => ({
              questionId: question.id,
              vendor_option_id: String(o.Id),
              option_text: o.OptionText.trim(),
              order_index: index,
            })),
            { transaction }
          );
        }
      }
      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  }

  return {
    success: true,
    totalQuestions: questions.length,
    questions,
  };
}

export async function ingestInnovateMRQuestions_v2({
  vendorId,
  apiConfigId,
  countryCode,
  language,
}) {
  if (!vendorId || !apiConfigId || !countryCode || !language) {
    throw new Error(
      "vendorId, apiConfigId, countryCode, language are required"
    );
  }

  // 1️⃣ Fetch API config
  const apiConfig = await VendorApiConfig.findByPk(apiConfigId);
  if (!apiConfig || !apiConfig.is_active) {
    throw new Error("Invalid or inactive VendorApiConfig");
  }
  console.log(">>>>> the value of the API CONFIG is : ", apiConfig);

  // 2️⃣ Call InnovateMR API
  const response = await axios.get(
    `${apiConfig.base_url}/pega/questions/${countryCode}/${language}`,
    {
      headers: {
        "x-access-token": `${apiConfig.credentials.token}`,
      },
    }
  );
  console.log(
    ">>>>> the value of the RESPONSE from INNOVATE MR is : ",
    response.data
  );

  const questions = response.data?.Questions;
  if (!Array.isArray(questions)) {
    throw new Error("Invalid InnovateMR response format");
  }

  const BATCH_SIZE = 10;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    const transaction = await sequelize.transaction();
    try {
      for (const q of batch) {
        if (hasInvalidCategory(q.Category)) {
          console.warn(`[SKIPPED QUESTION] Invalid category data`, {
            questionKey: q.QuestionKey,
            categories: q.Category,
          });
          continue;
        }

        const primaryCategory = q.Category.find((c) => c.Primary);

        let question = await ScreeningQuestionDefinition.findOne({
          where: {
            vendorId,
            question_key: q.QuestionKey,
            country_code: countryCode,
            language,
          },
          transaction,
        });

        const updateData = {
          question_text: q.QuestionText,
          question_type: q.QuestionType,
          vendor_question_id: String(q.Id),
          data_type: "STRING",
          source: "VENDOR",
          primary_vendor_category_id: primaryCategory ? String(primaryCategory.Id) : null,
          primary_vendor_category_name: primaryCategory?.Name ? primaryCategory.Name.toUpperCase() : null,
          categories_meta: { original_category: q.Category },
          is_active: true,
        };

        if (question) {
          await question.update(updateData, { transaction });
        } else {
          question = await ScreeningQuestionDefinition.create(
            {
              country_code: countryCode,
              language,
              question_key: q.QuestionKey,
              vendorId,
              ...updateData,
            },
            { transaction }
          );
        }

        await ScreenQuestionOption.destroy({
          where: { screeningQuestionId: question.id },
          transaction,
        });

        if (Array.isArray(q.Options) && q.Options.length > 0) {
          await ScreenQuestionOption.bulkCreate(
            q.Options.filter((o) => o && o.OptionText).map((o, index) => ({
              screeningQuestionId: question.id,
              option_text: o.OptionText.trim(),
              vendor_option_id: String(o.Id),
              order_index: index,
            })),
            { transaction }
          );
        }
      }
      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  }

  return {
    success: true,
    totalQuestions: questions.length,
    questions,
  };
}

export async function ingestInnovateMRQuestions_v3({
  vendorId,
  apiConfigId,
  countryCode,
  language,
}) {
  if (!vendorId || !apiConfigId || !countryCode || !language) {
    throw new Error(
      "vendorId, apiConfigId, countryCode, language are required"
    );
  }

  const apiConfig = await VendorApiConfig.findByPk(apiConfigId);
  if (!apiConfig || !apiConfig.is_active) {
    throw new Error("Invalid or inactive VendorApiConfig");
  }
  console.log(">>>>> the value of the API CONFIG is : ", apiConfig);

  const response = await axios.get(
    `${apiConfig.base_url}/pega/questions/${countryCode}/${language}`,
    {
      headers: {
        "x-access-token": `${apiConfig.credentials.token}`,
      },
    }
  );

  const questions = response.data?.Questions;
  if (!Array.isArray(questions)) {
    throw new Error("Invalid InnovateMR response format");
  }

  const BATCH_SIZE = 10;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    const transaction = await sequelize.transaction();
    try {
      for (const q of batch) {
        if (hasInvalidCategory(q.Category)) {
          console.warn(`[SKIPPED QUESTION] Invalid category data`, {
            questionKey: q.QuestionKey,
            categories: q.Category,
          });
          continue;
        }

        const primaryCategory = q.Category.find((c) => c.Primary);

        const existingQuestion = await ScreeningQuestionDefinition.findOne({
          where: {
            vendorId: vendorId,
            question_key: q.QuestionKey,
            country_code: countryCode,
            language: language,
          },
          transaction,
        });

        let question;

        if (existingQuestion) {
          question = await existingQuestion.update(
            {
              question_text: q.QuestionText,
              question_type: q.QuestionType,
              vendor_question_id: String(q.Id),
              data_type: "STRING",
              source: "VENDOR",
              primary_vendor_category_id: primaryCategory ? String(primaryCategory.Id) : null,
              primary_vendor_category_name: primaryCategory?.Name ? primaryCategory.Name.toUpperCase() : null,
              categories_meta: { original_category: q.Category },
              is_active: true,
            },
            { transaction }
          );
        } else {
          question = await ScreeningQuestionDefinition.create(
            {
              country_code: countryCode,
              language,
              question_key: q.QuestionKey,
              question_text: q.QuestionText,
              question_type: q.QuestionType,
              data_type: "STRING",
              source: "VENDOR",
              vendorId,
              vendor_question_id: String(q.Id),
              primary_vendor_category_id: primaryCategory ? String(primaryCategory.Id) : null,
              primary_vendor_category_name: primaryCategory?.Name ? primaryCategory.Name.toUpperCase() : null,
              categories_meta: { original_category: q.Category },
              is_active: true,
            },
            { transaction }
          );
        }

        await ScreenQuestionOption.destroy({
          where: { screeningQuestionId: question.id },
          transaction,
        });

        if (Array.isArray(q.Options) && q.Options.length > 0) {
          await ScreenQuestionOption.bulkCreate(
            q.Options.filter((o) => o && o.OptionText).map((o, index) => ({
              screeningQuestionId: question.id,
              option_text: o.OptionText.trim(),
              vendor_option_id: String(o.Id),
              order_index: index,
            })),
            { transaction }
          );
        }
      }
      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  }

  return {
    success: true,
    totalQuestions: questions.length,
    questions,
  };
}

export async function buildVendorTargetPayload(input) {
  if (!input || typeof input !== "object") return [];

  return Object.values(input)
    .map((item) => {
      if (!item || !item.vendorQuestionId) return null;

      const vendorQuestionId = parseInt(item.vendorQuestionId);

      if (item.openEnded) {
        const { mode } = item.openEnded;

        if (mode === "RANGE" && Array.isArray(item.openEnded.ranges)) {
          const options = item.openEnded.ranges
            .filter(
              (r) => typeof r.min === "number" && typeof r.max === "number"
            )
            .map((r) => `${r.min}-${r.max}`);

          return {
            questionId: vendorQuestionId,
            Options: options,
          };
        }

        if (mode === "NUMERIC" && Array.isArray(item.openEnded.textValues)) {
          const options = item.openEnded.textValues
            .map((t) => t && t.value)
            .filter(Boolean);

          return {
            questionId: vendorQuestionId,
            Options: options,
          };
        }

        return null;
      }

      if (Array.isArray(item.selectedVendorOptionIds)) {
        return {
          questionId: vendorQuestionId,
          Options: item.selectedVendorOptionIds.map(Number),
        };
      }

      return null;
    })
    .filter(Boolean);
}

export function buildQuotaConditions(targets) {
  const QUESTION_MAP = {
    1: "AGE",
    2: "GENDER",
    3: "ZIPCODES",
  };

  return targets.reduce((conditions, item) => {
    const key = QUESTION_MAP[item.questionId];

    if (key && Array.isArray(item.Options) && item.Options.length > 0) {
      conditions[key] = item.Options;
    }

    return conditions;
  }, {});
}

export function validateInnovateMRResponse(
  response,
  context = "InnovateMR API"
) {
  if (!response || response.status !== 200) {
    throw new Error(
      `[${context}] HTTP error. Expected 200, got ${response?.status}`
    );
  }

  const data = response.data;
  console.log(">>>>>>>>>>value of RESPONSE in VALIDATE function is : ", data);

  if (!data || typeof data !== "object") {
    throw new Error(`[${context}] Invalid response body from InnovateMR`);
  }

  if (data.apiStatus !== "success" && data.success != true) {
    throw new Error(
      `[${context}] InnovateMR failure: ${data.msg || "Unknown error"}`
    );
  }

  return data;
}

export async function ingestSurvey96Questions({
  vendorId,
  apiConfigId,
  countryCode,
  language,
}) {
  if (!vendorId || !apiConfigId || !countryCode || !language) {
    throw new Error(
      "vendorId, apiConfigId, countryCode, language are required"
    );
  }

  const apiConfig = await VendorApiConfig.findByPk(apiConfigId);
  if (!apiConfig || !apiConfig.is_active) {
    throw new Error("Invalid or inactive VendorApiConfig");
  }
  console.log(">>>>> the value of the API CONFIG is : ", apiConfig);

  const response = await axios.get(
    `${apiConfig.base_url}/questions/${countryCode}/${language}`,
    {
      headers: {
        "x-access-token": `${apiConfig.credentials.token}`,
      },
    }
  );
  console.log(
    ">>>>> the value of the RESPONSE from SURVEY 96 is : ",
    response.data
  );

  const questions = response.data?.data;

  if (!Array.isArray(questions)) {
    throw new Error("Invalid Survey96 response format");
  }

  const BATCH_SIZE = 10;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    const transaction = await sequelize.transaction();
    try {
      for (const q of batch) {
        let question = await ScreeningQuestionDefinition.findOne({
          where: {
            vendorId,
            question_key: q.question_key,
            country_code: countryCode,
            language,
          },
          transaction,
        });

        const updateData = {
          question_text: q.question_text,
          question_type: q.question_type,
          vendor_question_id: String(q.id),
          data_type: q.question_key == "AGE" ? "NUMBER" : "STRING",
          source: "VENDOR",
          primary_vendor_category_id: q.category?.id ? String(q.category.id) : null,
          primary_vendor_category_name: q.category?.name ? q.category.name.toUpperCase() : null,
          categories_meta: { original_category: q.category },
          is_active: true,
        };

        if (question) {
          await question.update(updateData, { transaction });
        } else {
          question = await ScreeningQuestionDefinition.create(
            {
              country_code: countryCode,
              language,
              question_key: q.question_key,
              vendorId,
              ...updateData,
            },
            { transaction }
          );
        }

        if (Array.isArray(q.question_options)) {
          for (const [index, o] of q.question_options.entries()) {
            if (!o || !o.option_text) continue;
            const vendorOptionId = o.id ? String(o.id) : null;

            let existingOpt = await ScreenQuestionOption.findOne({
              where: {
                screeningQuestionId: question.id,
                vendor_option_id: vendorOptionId,
              },
              transaction,
            });

            if (existingOpt) {
              await existingOpt.update(
                { option_text: o.option_text.trim() },
                { transaction }
              );
            } else {
              await ScreenQuestionOption.create(
                {
                  screeningQuestionId: question.id,
                  option_text: o.option_text.trim(),
                  vendor_option_id: vendorOptionId,
                  order_index: index,
                },
                { transaction }
              );
            }
          }
        }
      }
      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  }

  return {
    success: true,
    totalQuestions: questions.length,
    questions,
  };
}
