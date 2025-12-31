import axios from "axios";
import prisma from "../config/db.js";

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
  const apiConfig = await prisma.vendorApiConfig.findUnique({
    where: { id: apiConfigId },
  });
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

    await prisma.$transaction(async (tx) => {
      for (const q of batch) {
        // ❌ Skip question if categories are invalid
        if (hasInvalidCategory(q.Category)) {
          console.warn(`[SKIPPED QUESTION] Invalid category data`, {
            questionKey: q.QuestionKey,
            categories: q.Category,
          });
          continue;
        }

        const question = await tx.vendorQuestionLibrary.upsert({
          where: {
            vendorId_question_key_country_code_language: {
              vendorId,
              question_key: q.QuestionKey,
              country_code: countryCode,
              language,
            },
          },
          update: {
            question_text: q.QuestionText,
            question_type: q.QuestionType,
            vendor_question_id: String(q.Id),
            metadata: { standardTarget: q.StandardTarget },
            api_config_id: apiConfigId,
            is_active: true,
          },
          create: {
            vendorId,
            api_config_id: apiConfigId,
            country_code: countryCode,
            language,
            question_key: q.QuestionKey,
            question_text: q.QuestionText,
            question_type: q.QuestionType,
            vendor_question_id: String(q.Id),
            metadata: { standardTarget: q.StandardTarget },
          },
        });

        await tx.vendorQuestionCategory.deleteMany({
          where: { questionId: question.id },
        });

        await tx.vendorQuestionOption.deleteMany({
          where: { questionId: question.id },
        });

        // ✅ Categories (safe now)
        await tx.vendorQuestionCategory.createMany({
          data: q.Category.map((c, index) => ({
            questionId: question.id,
            vendor_category_id: String(c.Id),
            category_name: c.Name.trim(),
            is_primary: Boolean(c.Primary),
            order_index: index,
          })),
        });

        // ✅ Options (optional but still validate)
        if (Array.isArray(q.Options) && q.Options.length > 0) {
          await tx.vendorQuestionOption.createMany({
            data: q.Options.filter((o) => o && o.OptionText).map(
              (o, index) => ({
                questionId: question.id,
                vendor_option_id: String(o.Id),
                option_text: o.OptionText.trim(),
                order_index: index,
              })
            ),
          });
        }
      }
    });
  }

  //   // 3️⃣ Persist in a transaction
  //   await prisma.$transaction(async (tx) => {
  //     for (const q of questions) {
  //       // 3.1 Upsert Question
  //       const question = await tx.vendorQuestionLibrary.upsert({
  //         where: {
  //           vendorId_question_key_country_code_language: {
  //             vendorId,
  //             question_key: q.QuestionKey,
  //             country_code: countryCode,
  //             language: language,
  //           },
  //         },
  //         update: {
  //           question_text: q.QuestionText,
  //           question_type: q.QuestionType,
  //           vendor_question_id: String(q.Id),
  //           metadata: {
  //             standardTarget: q.StandardTarget,
  //           },
  //           api_config_id: apiConfigId,
  //           is_active: true,
  //         },
  //         create: {
  //           vendorId,
  //           api_config_id: apiConfigId,
  //           country_code: countryCode,
  //           language,
  //           question_key: q.QuestionKey,
  //           question_text: q.QuestionText,
  //           question_type: q.QuestionType,
  //           vendor_question_id: String(q.Id),
  //           metadata: {
  //             standardTarget: q.StandardTarget,
  //           },
  //         },
  //       });

  //       // 3.2 Reset categories & options (authoritative source)
  //       await tx.vendorQuestionCategory.deleteMany({
  //         where: { questionId: question.id },
  //       });

  //       await tx.vendorQuestionOption.deleteMany({
  //         where: { questionId: question.id },
  //       });

  //       // 3.3 Insert Categories
  //       if (Array.isArray(q.Category)) {
  //         await tx.vendorQuestionCategory.createMany({
  //           data: q.Category.map((c, index) => ({
  //             questionId: question.id,
  //             vendor_category_id: String(c.Id),
  //             category_name: c.Name,
  //             is_primary: Boolean(c.Primary),
  //             order_index: index,
  //           })),
  //         });
  //       }

  //       // 3.4 Insert Options
  //       if (Array.isArray(q.Options) && q.Options.length > 0) {
  //         await tx.vendorQuestionOption.createMany({
  //           data: q.Options.map((o, index) => ({
  //             questionId: question.id,
  //             vendor_option_id: String(o.Id),
  //             option_text: o.OptionText,
  //             order_index: index,
  //           })),
  //         });
  //       }
  //     }
  //   });

  return {
    success: true,
    totalQuestions: questions.length,
    questions,
  };
}

export async function buildVendorTargetPayload(input) {
  if (!input || typeof input !== "object") return [];

  return (
    Object.values(input)
      .map((item) => {
        if (!item || !item.vendorQuestionId) return null;

        const vendorQuestionId = parseInt(item.vendorQuestionId);

        // =========================
        // OPEN ENDED QUESTIONS
        // =========================
        if (item.openEnded) {
          const { mode } = item.openEnded;

          // RANGE (e.g. AGE)
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

          // TEXT VALUES
          if (mode === "NUMERIC" && Array.isArray(item.openEnded.textValues)) {
            const options = item.openEnded.textValues
              .map((t) => t && t.value)
              .filter(Boolean);

            return {
              questionId: vendorQuestionId,
              Options: options,
            };
          }

          // Unknown / invalid openEnded config
          return null;
        }

        // =========================
        // CLOSED / MULTI SELECT
        // =========================
        if (Array.isArray(item.selectedVendorOptionIds)) {
          return {
            questionId: vendorQuestionId,
            Options: item.selectedVendorOptionIds.map(Number),
          };
        }

        return null;
      })
      // Remove invalid questions
      .filter(Boolean)
  );
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

/**
 * Validates InnovateMR API response
 * @param {Object} response - axios/fetch response
 * @param {string} context - operation name (for logs)
 * @returns {Object} response.data
 * @throws Error
 */
export function validateInnovateMRResponse(
  response,
  context = "InnovateMR API"
) {
  // 1. HTTP-level validation
  if (!response || response.status !== 200) {
    throw new Error(
      `[${context}] HTTP error. Expected 200, got ${response?.status}`
    );
  }

  const data = response.data;

  // 2. Payload existence
  if (!data || typeof data !== "object") {
    throw new Error(`[${context}] Invalid response body from InnovateMR`);
  }

  // 3. Business-level status
  if (data.apiStatus !== "success") {
    throw new Error(
      `[${context}] InnovateMR failure: ${data.msg || "Unknown error"}`
    );
  }

  return data;
}
