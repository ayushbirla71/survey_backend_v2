import {
  Question,
  Option,
  QuestionCategory,
  MediaAsset,
  AIGeneratedQuestion,
} from "../models/index.js";
import { generatePresignedUrl } from "../utils/uploadToS3.js";

export const createQuestionsWithOptions = async (
  questionData,
  options,
  categoryId,
  rowOptions,
  columnOptions
) => {
  try {
    // Create Question
    const question = await Question.create(questionData);

    let optionRecords = [];

    // Get category type
    let categoryType = "";
    if (categoryId) {
      const category = await QuestionCategory.findByPk(categoryId, {
        attributes: ["type_name"],
      });
      categoryType = category?.type_name?.toLowerCase() || "";
    }

    // Handle Options based on Category Type
    switch (categoryType) {
      case "multiple choice":
      case "checkboxes":
      case "dropdown":
      case "ranking":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            mediaId: opt.mediaId || null,
          }));
        }
        break;

      case "short answer":
      case "paragraph":
      case "number":
        break;

      case "linear scale":
      case "rating":
      case "nps":
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

      case "multi-choice grid":
      case "checkbox grid":
        if (rowOptions && rowOptions.length > 0) {
          const rowOptionRecords = rowOptions.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            rowQuestionOptionId: question.id,
          }));
          optionRecords.push(...rowOptionRecords);
        }

        if (columnOptions && columnOptions.length > 0) {
          const columnOptionRecords = columnOptions.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
            columnQuestionOptionId: question.id,
          }));
          optionRecords.push(...columnOptionRecords);
        }
        break;

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
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: question.id,
          }));
        }
        break;
    }

    if (optionRecords.length > 0) {
      await Option.bulkCreate(optionRecords);
    }

    return question;
  } catch (error) {
    console.error("Create Question Error:", error);
    throw error;
  }
};

const signMedia = async (mediaAsset) => {
  if (!mediaAsset) return null;

  mediaAsset.url = await generatePresignedUrl(
    process.env.AWS_BUCKET_NAME,
    mediaAsset.url
  );

  return mediaAsset;
};

const signQuestion = async (q) => {
  if (!q) return q;

  if (q.mediaAsset) await signMedia(q.mediaAsset);

  for (const opt of q.options || []) {
    if (opt.mediaAsset) await signMedia(opt.mediaAsset);
  }
  for (const row of q.rowOptions || []) {
    if (row.mediaAsset) await signMedia(row.mediaAsset);
  }
  for (const col of q.columnOptions || []) {
    if (col.mediaAsset) await signMedia(col.mediaAsset);
  }

  return q;
};

const questionIncludeOptions = [
  {
    model: Option,
    as: "options",
    include: [{ model: MediaAsset, as: "mediaAsset" }],
  },
  {
    model: Option,
    as: "rowOptions",
    include: [{ model: MediaAsset, as: "mediaAsset" }],
  },
  {
    model: Option,
    as: "columnOptions",
    include: [{ model: MediaAsset, as: "mediaAsset" }],
  },
  { model: MediaAsset, as: "mediaAsset" },
  { model: QuestionCategory, as: "category" },
];

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
      max_rank_allowed,
      min_rank_required,
      allow_partial_rank,
    } = body;

    const questionData = {
      surveyId,
      question_type,
      question_text,
      order_index,
      required,
      categoryId,
    };
    if (mediaId) questionData.mediaId = mediaId;
    if (max_rank_allowed) questionData.max_rank_allowed = max_rank_allowed;
    if (min_rank_required) questionData.min_rank_required = min_rank_required;
    if (allow_partial_rank !== undefined)
      questionData.allow_partial_rank = allow_partial_rank;

    const question = await createQuestionsWithOptions(
      questionData,
      options,
      categoryId,
      rowOptions,
      columnOptions
    );
    console.log(">>>>> the value of the QUESTION is : ", question);

    const questionWithOptionsModel = await Question.findByPk(question.id, {
      include: questionIncludeOptions,
    });

    const questionWithOptions = questionWithOptionsModel ? questionWithOptionsModel.toJSON() : null;

    const attachPresignedUrl = async (mediaAsset) => {
      if (!mediaAsset) return null;
      mediaAsset.url = await generatePresignedUrl(
        process.env.AWS_BUCKET_NAME,
        mediaAsset.url
      );
      return mediaAsset;
    };

    if (questionWithOptions) {
      if (questionWithOptions.mediaAsset) {
        await attachPresignedUrl(questionWithOptions.mediaAsset);
      }
      for (const opt of questionWithOptions.options || []) {
        if (opt.mediaAsset) await attachPresignedUrl(opt.mediaAsset);
      }
      for (const row of questionWithOptions.rowOptions || []) {
        if (row.mediaAsset) await attachPresignedUrl(row.mediaAsset);
      }
      for (const col of questionWithOptions.columnOptions || []) {
        if (col.mediaAsset) await attachPresignedUrl(col.mediaAsset);
      }
    }

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

    const questions = await Question.findAll({
      where: { surveyId },
      order: [["order_index", "ASC"]],
      include: questionIncludeOptions,
    });

    const questionsJson = questions.map((q) => q.toJSON());

    const attachPresignedUrl = async (mediaAsset) => {
      if (!mediaAsset) return null;
      mediaAsset.url = await generatePresignedUrl(
        process.env.AWS_BUCKET_NAME,
        mediaAsset.url
      );
      return mediaAsset;
    };

    for (const q of questionsJson) {
      if (q.mediaAsset) await attachPresignedUrl(q.mediaAsset);
      for (const opt of q.options || []) {
        if (opt.mediaAsset) await attachPresignedUrl(opt.mediaAsset);
      }
      for (const row of q.rowOptions || []) {
        if (row.mediaAsset) await attachPresignedUrl(row.mediaAsset);
      }
      for (const col of q.columnOptions || []) {
        if (col.mediaAsset) await attachPresignedUrl(col.mediaAsset);
      }
    }

    res.json(questionsJson);
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
      const q = await Question.findByPk(id, {
        include: questionIncludeOptions,
      });
      questions = q ? q.toJSON() : null;
    } else if (surveyId) {
      const qList = await Question.findAll({
        where: { surveyId },
        order: [["order_index", "ASC"]],
        include: questionIncludeOptions,
      });
      questions = qList.map((item) => item.toJSON());
    }

    if (!questions)
      return res.status(404).json({ message: "Question(s) not found" });

    console.log(">>>>> the value of the QUESTIONS is : ", questions);

    if (Array.isArray(questions)) {
      for (const q of questions) {
        await signQuestion(q);
      }
    } else {
      await signQuestion(questions);
    }

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
    const aiQuestions = await AIGeneratedQuestion.findAll({
      where: { surveyId },
      order: [["order_index", "ASC"]],
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
      max_rank_allowed,
      min_rank_required,
      allow_partial_rank,
    } = req.body;

    const question = await Question.findByPk(id);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    const updateData = {
      question_type,
      question_text,
      order_index,
      required,
      categoryId,
      mediaId,
    };
    if (max_rank_allowed !== undefined) updateData.max_rank_allowed = max_rank_allowed;
    if (min_rank_required !== undefined) updateData.min_rank_required = min_rank_required;
    if (allow_partial_rank !== undefined) updateData.allow_partial_rank = allow_partial_rank;

    // Step 1: Update question
    await Question.update(updateData, { where: { id } });

    // Step 2: Delete old options
    await Option.destroy({ where: { questionId: id } });

    // Step 3: Get category type
    let categoryType = "";
    if (categoryId) {
      const category = await QuestionCategory.findByPk(categoryId, {
        attributes: ["type_name"],
      });
      categoryType = category?.type_name?.toLowerCase() || "";
    }
    console.log(">>>>>> UPDATE - Category Type is : ", categoryType);

    // Step 4: Recreate options based on category type
    let optionRecords = [];

    switch (categoryType) {
      case "multiple choice":
      case "checkboxes":
      case "dropdown":
      case "ranking":
        if (options && options.length > 0) {
          optionRecords = options.map((opt) => ({
            text: opt.text || "",
            questionId: id,
            mediaId: opt.mediaId || null,
          }));
        }
        break;

      case "short answer":
      case "paragraph":
      case "number":
        break;

      case "linear scale":
      case "rating":
      case "nps":
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
        if (rowOptions && rowOptions.length > 0) {
          const rowOptionRecords = rowOptions.map((opt) => ({
            text: opt.text || "",
            questionId: id,
            rowQuestionOptionId: id,
          }));
          optionRecords.push(...rowOptionRecords);
        }

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

    if (optionRecords.length > 0) {
      await Option.bulkCreate(optionRecords);
    }

    const finalQuestionModel = await Question.findByPk(id, {
      include: questionIncludeOptions,
    });
    const finalQuestion = finalQuestionModel ? finalQuestionModel.toJSON() : null;

    const attachPresignedUrl = async (mediaAsset) => {
      if (!mediaAsset) return null;
      mediaAsset.url = await generatePresignedUrl(
        process.env.AWS_BUCKET_NAME,
        mediaAsset.url
      );
      return mediaAsset;
    };

    if (finalQuestion) {
      if (finalQuestion.mediaAsset) {
        await attachPresignedUrl(finalQuestion.mediaAsset);
      }
      for (const opt of finalQuestion.options || []) {
        if (opt.mediaAsset) await attachPresignedUrl(opt.mediaAsset);
      }
      for (const row of finalQuestion.rowOptions || []) {
        if (row.mediaAsset) await attachPresignedUrl(row.mediaAsset);
      }
      for (const col of finalQuestion.columnOptions || []) {
        if (col.mediaAsset) await attachPresignedUrl(col.mediaAsset);
      }
    }

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

    const question = await Question.findByPk(id);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    await Option.destroy({ where: { questionId: id } });
    await Question.destroy({ where: { id } });

    res.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Delete Question Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
