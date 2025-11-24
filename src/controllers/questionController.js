import prisma from "../config/db.js";

export const createQuestionsWithOptions = async (
  questionData,
  options,
  categoryId,
  rowOptions,
  columnOptions
) => {
  try {
    // console.log(
    //   ">>>>>>>> ENTERED the create Question with OPtions function......."
    // );
    // console.log(">>>>> the value of the QUESTION DATA is : ", questionData);

    // Create Question
    const question = await prisma.question.create({
      data: questionData,
    });

    let optionRecords = [];

    // Get category type
    const category = await prisma.questionCategory.findUnique({
      where: { id: categoryId },
      select: { type_name: true },
    });

    const categoryType = category?.type_name?.toLowerCase();
    // console.log(">>>>>> the value of the CATEGORY TYPE is : ", categoryType);

    // Step 3: Handle Options based on Category Type
    switch (categoryType) {
      // Multiple Choice, Checkbox, Dropdown — store text and optional media
      case "multiple choice":
      case "checkboxes":
      case "dropdown":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            mediaId: opt.mediaId || null,
          }));
        }
        break;

      // Linear Scale / Rating — store scale values and labels
      case "linear scale":
      case "rating":
        if (options && options.length > 0 && options[0]) {
          const scale = options[0];
          optionRecords.push({
            questionId: question.id,
            rangeFrom: scale.rangeFrom,
            rangeTo: scale.rangeTo,
            fromLabel: scale.fromLabel,
            toLabel: scale.toLabel,
            icon: scale.icon,
          });
        }
        break;

      // Multi-choice grid or checkbox grid — need row and column mapping
      case "multi-choice grid":
      case "checkbox grid":
        // Row options
        if (rowOptions && rowOptions.length > 0) {
          const rowOptionRecords = rowOptions.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            rowQuestionOptionId: question.id, // links to this question as row
          }));
          optionRecords.push(...rowOptionRecords);
        }

        // Column options
        if (columnOptions && columnOptions.length > 0) {
          const columnOptionRecords = columnOptions.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            columnQuestionOptionId: question.id, // links to this question as column
          }));
          optionRecords.push(...columnOptionRecords);
        }
        break;

      // File upload, Date, Time — store in text field or media as needed
      case "file upload":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            mediaId: opt.mediaId || null,
          }));
        }
        break;

      case "date":
      case "time":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
          }));
        }
        break;

      default:
        // For safety fallback
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
          }));
        }
        break;
    }

    // Step 4: Bulk Create Options
    if (optionRecords.length > 0) {
      await prisma.option.createMany({
        data: optionRecords,
      });
    }

    return question;
  } catch (error) {
    console.error("Create Question Error:", error);
    throw error;
  }
};

/**
 * Create Question
 */
export const createQuestion = async (req, res) => {
  try {
    const body = req.body;
    console.log(">>>>> the value of the BODY is : ", body);

    const {
      surveyId,
      question_type,
      question_text,
      mediaId,
      order_index,
      required = true,
      categoryId,
      options = [],
      rowOptions = [],
      columnOptions = [],
    } = body;

    // Prepare Question Data
    const questionData = {
      surveyId,
      question_type,
      question_text,
      order_index,
      required,
      categoryId,
    };
    if (mediaId) questionData.mediaId = mediaId;

    const question = await createQuestionsWithOptions(
      questionData,
      options,
      categoryId,
      rowOptions,
      columnOptions
    );
    console.log(">>>>> the value of the QUESTION is : ", question);

    // Step 5: Return Response
    const questionWithOptions = await prisma.question.findUnique({
      where: { id: question.id },
      include: {
        options: true,
        rowOptions: true,
        columnOptions: true,
        mediaAsset: true,
        category: true,
      },
    });

    res.status(201).json({
      message: "Question created successfully",
      question: questionWithOptions,
    });
  } catch (error) {
    console.error("Create Question Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all questions of a survey
 */
export const getQuestionsBySurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const questions = await prisma.question.findMany({
      where: { surveyId },
      orderBy: { order_index: "asc" },
      include: {
        options: {
          include: { mediaAsset: true },
        },
        rowOptions: {
          include: { mediaAsset: true },
        },
        columnOptions: {
          include: { mediaAsset: true },
        },
        mediaAsset: true,
        category: true,
      },
    });

    res.json(questions);
  } catch (error) {
    console.error("Get Questions Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getQuestions = async (req, res) => {
  try {
    const { id, surveyId } = req.query;

    if (!id && !surveyId)
      return res
        .status(400)
        .json({ message: "Please provide question id or surveyId" });

    let questions;

    if (id) {
      questions = await prisma.question.findUnique({
        where: { id },
        include: {
          options: {
            include: { mediaAsset: true },
          },
          rowOptions: {
            include: { mediaAsset: true },
          },
          columnOptions: {
            include: { mediaAsset: true },
          },
          mediaAsset: true,
          category: true,
        },
      });

      // For single question, also format grid types if needed
      if (
        questions &&
        questions.rowOptions &&
        questions.rowOptions.length > 0
      ) {
        // Keep the original structure but ensure grid options are accessible
        // The frontend can use rowOptions and columnOptions directly
      }
    } else if (surveyId) {
      questions = await prisma.question.findMany({
        where: { surveyId },
        orderBy: { order_index: "asc" },
        include: {
          options: {
            include: { mediaAsset: true },
          },
          rowOptions: {
            include: { mediaAsset: true },
          },
          columnOptions: {
            include: { mediaAsset: true },
          },
          mediaAsset: true,
          category: true,
        },
      });

      // No need to restructure - frontend can access rowOptions and columnOptions directly
      // The original structure is preserved
    }

    if (!questions)
      return res.status(404).json({ message: "Question(s) not found" });

    res.status(200).json(questions);
  } catch (error) {
    console.error("Get Questions Error:", error);
    res.status(500).json({
      message: "Server error while fetching questions",
      error: error.message,
    });
  }
};

export const getAiGeneratedQuestions = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const aiQuestions = await prisma.aIGeneratedQuestion.findMany({
      where: { surveyId },
      orderBy: { order_index: "asc" },
    });

    res.json(aiQuestions);
  } catch (error) {
    console.error("Get AI Questions Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update question
 */

export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question_type,
      question_text,
      order_index,
      required,
      categoryId,
      mediaId,
      options = [],
      rowOptions = [],
      columnOptions = [],
    } = req.body;

    const question = await prisma.question.findUnique({ where: { id } });
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    // Step 1: Update question
    await prisma.question.update({
      where: { id },
      data: {
        question_type,
        question_text,
        order_index,
        required,
        categoryId,
        mediaId,
      },
    });

    // Step 2: Delete old options
    await prisma.option.deleteMany({
      where: { questionId: id },
    });

    // Step 3: Get category type
    const category = await prisma.questionCategory.findUnique({
      where: { id: categoryId },
      select: { type_name: true },
    });

    const categoryType = category?.type_name?.toLowerCase();
    console.log(">>>>>> UPDATE - Category Type is : ", categoryType);

    // Step 4: Recreate options based on category type
    let optionRecords = [];

    switch (categoryType) {
      case "short answer":
      case "paragraph":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: id,
          }));
        }
        break;

      case "multiple choice":
      case "checkboxes":
      case "dropdown":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: id,
            mediaId: opt.mediaId || null,
          }));
        }
        break;

      case "linear scale":
      case "rating":
        if (options && options.length > 0 && options[0]) {
          const scale = options[0];
          optionRecords.push({
            questionId: id,
            rangeFrom: scale.rangeFrom,
            rangeTo: scale.rangeTo,
            fromLabel: scale.fromLabel,
            toLabel: scale.toLabel,
            icon: scale.icon,
          });
        }
        break;

      case "multi-choice grid":
      case "checkbox grid":
        // Row options
        if (rowOptions && rowOptions.length > 0) {
          const rowOptionRecords = rowOptions.map((opt) => ({
            text: opt.text || "",
            questionId: id,
            rowQuestionOptionId: id,
          }));
          optionRecords.push(...rowOptionRecords);
        }

        // Column options
        if (columnOptions && columnOptions.length > 0) {
          const columnOptionRecords = columnOptions.map((opt) => ({
            text: opt.text || "",
            questionId: id,
            columnQuestionOptionId: id,
          }));
          optionRecords.push(...columnOptionRecords);
        }
        break;

      case "file upload":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: id,
            mediaId: opt.mediaId || null,
          }));
        }
        break;

      case "date":
      case "time":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: id,
          }));
        }
        break;

      default:
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: id,
          }));
        }
        break;
    }

    // Step 5: Create new options
    if (optionRecords.length > 0) {
      await prisma.option.createMany({
        data: optionRecords,
      });
    }

    // Step 6: Fetch and return updated question with all relations
    const finalQuestion = await prisma.question.findUnique({
      where: { id },
      include: {
        options: true,
        rowOptions: true,
        columnOptions: true,
        mediaAsset: true,
        category: true,
      },
    });

    res.status(200).json({
      message: "Question updated successfully",
      question: finalQuestion,
    });
  } catch (error) {
    console.error("Update Question Error:", error);
    res.status(500).json({
      message: "Server error while updating question",
      error: error.message,
    });
  }
};

/**
 * Delete question
 */
export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await prisma.question.findUnique({ where: { id } });
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    await prisma.option.deleteMany({
      where: { questionId: id },
    });

    await prisma.question.delete({ where: { id } });

    res.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Delete Question Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
