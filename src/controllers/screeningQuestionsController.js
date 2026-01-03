import prisma from "../config/db.js";

export const getScreeningQuestions = async (req, res) => {
  try {
    const {
      source = "CUSTOM",
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

    const questions = await prisma.screeningQuestionDefinition.findMany({
      where: findQuestionsWhere,
      include: { options: true },
    });
    console.log(">>>>> the value of the SCREENING QUESTIONS is : ", questions);

    return res.json({
      message: "Screening Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("Get Screening Questions Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

async function resetQuestionOptions(tx, questionId, options) {
  await tx.screenQuestionOption.deleteMany({
    where: { screeningQuestionId: questionId },
  });

  if (!Array.isArray(options) || options.length === 0) return;

  await tx.screenQuestionOption.createMany({
    data: options
      .filter((o) => typeof o === "string" && o.trim())
      .map((text, index) => ({
        screeningQuestionId: questionId,
        option_text: text.trim(),
        order_index: index,
      })),
  });
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

    const questionWithOptions = await prisma.$transaction(async (tx) => {
      // 1. UPSERT QUESTION
      const question = await tx.screeningQuestionDefinition.upsert({
        where: {
          system_question_unique: {
            question_key,
            country_code,
            language,
          },
        },
        update: {
          question_text,
          question_type,
          data_type,
          source,
          is_active: true,

          // Explicitly enforce NON-vendor state
          vendorId: null,
          vendor_question_id: null,
          primary_vendor_category_id: null,
          primary_vendor_category_name: null,
          categories_meta: null,
        },
        create: {
          country_code,
          language,
          question_key,
          question_text,
          question_type,
          data_type,
          source,
          is_active: true,
        },
      });

      await resetQuestionOptions(tx, question.id, options);

      // 2.3 RETURN CONSISTENT VIEW
      return tx.screeningQuestionDefinition.findUnique({
        where: { id: question.id },
        include: { options: true },
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

    // Nothing to update?
    if (Object.keys(updateData).length === 0 && options === undefined) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const questionWithOptions = await prisma.$transaction(async (tx) => {
      // 1. UPSERT QUESTION
      const question = await tx.screeningQuestionDefinition.update({
        where: { id },
        data: updateData,
      });

      // Only touch options if client sent them
      if (options !== undefined) {
        await resetQuestionOptions(tx, question.id, options);
      }
      // 2.3 RETURN CONSISTENT VIEW
      return tx.screeningQuestionDefinition.findUnique({
        where: { id: question.id },
        include: { options: true },
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

    await prisma.screeningQuestionDefinition.delete({ where: { id } });

    return res.json({ message: "Screening Question deleted" });
  } catch (error) {
    console.error("Delete Screening Question Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
