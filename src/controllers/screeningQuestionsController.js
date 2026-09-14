import sequelize, {
  ScreeningQuestionDefinition,
  ScreenQuestionOption,
  VendorApiConfig,
  SurveyQuotaOption,
} from "../models/index.js";
import { fetchQuestionsFromVendor } from "../services/vendorQuestionService.js";

export const getScreeningQuestions = async (req, res) => {
  try {
    const {
      source = "SYSTEM",
      vendorId,
      countryCode = "IN",
      language = "ENGLISH",
    } = req.query;

    const findQuestionsWhere = {
      country_code: countryCode,
      language,
      source,
    };
    if (source === "VENDOR") {
      findQuestionsWhere.vendorId = vendorId;
    }
    console.log(
      ">>>>> the value of the FIND QUESTIONS WHERE is : ",
      findQuestionsWhere
    );

    let questions = await ScreeningQuestionDefinition.findAll({
      where: findQuestionsWhere,
      include: [{ model: ScreenQuestionOption, as: "options" }],
    });
    console.log(">>>>> the value of the SCREENING QUESTIONS is : ", questions);

    if (questions.length === 0 && source === "VENDOR") {
      const apiConfig = await VendorApiConfig.findOne({
        where: { vendorId, is_default: true },
        attributes: ["id"],
      });
      console.log(">>>>> the value of the API CONFIG is : ", apiConfig);
      if (!apiConfig) {
        return res.status(404).json({ message: "API Config not found" });
      }

      await fetchQuestionsFromVendor({
        vendorId,
        apiConfigId: apiConfig.id,
        countryCode,
        language,
      });

      questions = await ScreeningQuestionDefinition.findAll({
        where: findQuestionsWhere,
        include: [{ model: ScreenQuestionOption, as: "options" }],
      });
    }

    return res.json({
      message: "Screening Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("Get Screening Questions Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateScreeningQuestionsListFromVendorSide = async (req, res) => {
  try {
    const {
      source = "SYSTEM",
      vendorId,
      countryCode = "IN",
      language = "ENGLISH",
    } = req.query;

    const apiConfig = await VendorApiConfig.findOne({
      where: { vendorId, is_default: true },
      attributes: ["id"],
    });
    console.log(">>>>> the value of the API CONFIG is : ", apiConfig);
    if (!apiConfig) {
      return res.status(404).json({ message: "API Config not found" });
    }

    await fetchQuestionsFromVendor({
      vendorId,
      apiConfigId: apiConfig.id,
      countryCode,
      language,
    });

    const questions = await ScreeningQuestionDefinition.findAll({
      where: { country_code: countryCode, language, source, vendorId },
      include: [{ model: ScreenQuestionOption, as: "options" }],
    });

    return res.json({
      message: "Screening Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("Update Screening Questions List api Error:", error);
    return res.status(500).json({ message: "Internal Server error" });
  }
};

async function resetQuestionOptions(t, questionId, options) {
  await ScreenQuestionOption.destroy({
    where: { screeningQuestionId: questionId },
    transaction: t,
  });

  if (!Array.isArray(options) || options.length === 0) return;

  await ScreenQuestionOption.bulkCreate(
    options.map((option) => ({
      screeningQuestionId: questionId,
      option_text: option.option_text.trim(),
      order_index: option.order_index,
    })),
    { transaction: t }
  );
}

export const createScreeningQuestion = async (req, res) => {
  try {
    const data = req.body;
    console.log(">>>>> the value of the DATA is : ", data);

    const {
      country_code,
      language,
      question_key,
      question_text,
      question_type,
      data_type,
      source,
      options,
    } = data;
    if (
      !country_code ||
      !language ||
      !question_key ||
      !question_text ||
      !question_type ||
      !data_type ||
      !source
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const questionWithOptions = await sequelize.transaction(async (t) => {
      const existingSystem = await ScreeningQuestionDefinition.findOne({
        where: {
          vendorId: null,
          question_key,
          country_code,
          language,
        },
        transaction: t,
      });

      let question;

      if (existingSystem) {
        await ScreeningQuestionDefinition.update(
          {
            question_text,
            question_type,
            data_type,
            source: "SYSTEM",
            is_active: true,
            vendorId: null,
            vendor_question_id: null,
            primary_vendor_category_id: null,
            primary_vendor_category_name: null,
            categories_meta: null,
          },
          { where: { id: existingSystem.id }, transaction: t }
        );
        question = await ScreeningQuestionDefinition.findByPk(existingSystem.id, {
          transaction: t,
        });
      } else {
        question = await ScreeningQuestionDefinition.create(
          {
            country_code,
            language,
            question_key,
            question_text,
            question_type,
            data_type,
            source: "SYSTEM",
            vendorId: null,
            is_active: true,
          },
          { transaction: t }
        );
      }

      await resetQuestionOptions(t, question.id, options);

      return await ScreeningQuestionDefinition.findByPk(question.id, {
        include: [{ model: ScreenQuestionOption, as: "options" }],
        transaction: t,
      });
    });
    console.log(
      ">>>>> the value of the QUESTION WITH OPTIONS is : ",
      questionWithOptions
    );

    return res.json({
      message: "Screening Question created successfully",
      data: questionWithOptions,
    });
  } catch (error) {
    console.error("Create Screening Question Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateScreeningQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      country_code,
      language,
      question_key,
      question_text,
      question_type,
      data_type,
      options,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Question ID is required" });
    }

    const updateData = {};

    if (country_code !== undefined) updateData.country_code = country_code;
    if (language !== undefined) updateData.language = language;
    if (question_key !== undefined) updateData.question_key = question_key;
    if (question_text !== undefined) updateData.question_text = question_text;
    if (question_type !== undefined) updateData.question_type = question_type;
    if (data_type !== undefined) updateData.data_type = data_type;

    if (Object.keys(updateData).length === 0 && options === undefined) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const questionWithOptions = await sequelize.transaction(async (t) => {
      await ScreeningQuestionDefinition.update(updateData, {
        where: { id },
        transaction: t,
      });
      const question = await ScreeningQuestionDefinition.findByPk(id, {
        transaction: t,
      });

      if (options !== undefined) {
        await resetQuestionOptions(t, question.id, options);
      }

      return await ScreeningQuestionDefinition.findByPk(question.id, {
        include: [{ model: ScreenQuestionOption, as: "options" }],
        transaction: t,
      });
    });
    console.log(
      ">>>>> the value of the QUESTION WITH OPTIONS is : ",
      questionWithOptions
    );

    return res.json({
      message: "Screening Question updated successfully",
      data: questionWithOptions,
    });
  } catch (error) {
    console.error("Update Screening Question Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteScreeningQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    await SurveyQuotaOption.destroy({
      where: { screeningQuestionId: id },
    });

    await ScreeningQuestionDefinition.destroy({ where: { id } });

    return res.json({ message: "Screening Question deleted" });
  } catch (error) {
    console.error("Delete Screening Question Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
