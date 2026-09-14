import { Op } from "sequelize";
import {
  Survey,
  Question,
  Option,
  Response,
  ResponseAnswer,
  GridResponseAnswer,
} from "../models/index.js";

/**
 * Get Survey Results with Filters and Pagination
 * Supports: pagination, date range, question filtering, response status
 */
export const getSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      questionId,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    // Validate survey exists
    const survey = await Survey.findByPk(surveyId, {
      include: [{ model: Question, as: "questions" }],
    });
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    // Build where clause
    const whereClause = { surveyId };
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const totalResponses = await Response.count({ where: whereClause });

    // Build include for response_answers
    const responseAnswerInclude = {
      model: ResponseAnswer,
      as: "response_answers",
      include: [
        {
          model: Question,
          as: "question",
          include: [{ model: Option, as: "options" }],
        },
        {
          model: GridResponseAnswer,
          as: "grid_answers",
        },
      ],
    };
    if (questionId) {
      responseAnswerInclude.where = { questionId };
      responseAnswerInclude.required = false;
    }

    // Get responses with pagination
    const responses = await Response.findAll({
      where: whereClause,
      include: [responseAnswerInclude],
      order: [[sortBy, sortOrder.toUpperCase()]],
      offset,
      limit: parseInt(limit),
    });

    res.json({
      message: "Survey results retrieved",
      data: {
        surveyId,
        surveyTitle: survey.title,
        totalResponses,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResponses / parseInt(limit)),
        responses,
      },
    });
  } catch (error) {
    console.error("Get Survey Results Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get Survey Results Summary with Statistics
 */
export const getSurveyResultsSummary = async (req, res) => {
  try {
    const { surveyId } = req.params;

    // Validate survey exists
    const survey = await Survey.findByPk(surveyId, {
      include: [{ model: Question, as: "questions" }],
    });
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    // Total responses
    const totalResponses = await Response.count({ where: { surveyId } });

    // Get all responses with answers
    const responses = await Response.findAll({
      where: { surveyId },
      include: [
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            {
              model: Question,
              as: "question",
              include: [{ model: Option, as: "options" }],
            },
            {
              model: GridResponseAnswer,
              as: "grid_answers",
            },
          ],
        },
      ],
    });

    // Calculate completion rate
    const completionRate =
      responses.length === 0
        ? 0
        : (responses.filter((r) => r.response_answers && r.response_answers.length > 0).length /
            responses.length) *
          100;

    // Get response timeline
    const responseTimeline = responses.reduce((acc, r) => {
      const date = new Date(r.created_at).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    res.json({
      message: "Survey results summary retrieved",
      data: {
        surveyId,
        surveyTitle: survey.title,
        totalQuestions: survey.questions ? survey.questions.length : 0,
        totalResponses,
        completionRate: completionRate.toFixed(2),
        responseTimeline,
        avgResponsesPerDay:
          Object.keys(responseTimeline).length > 0
            ? (totalResponses / Object.keys(responseTimeline).length).toFixed(2)
            : 0,
      },
    });
  } catch (error) {
    console.error("Get Survey Results Summary Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get Question-wise Results with Answer Distribution
 */
export const getQuestionResults = async (req, res) => {
  try {
    const { surveyId, questionId } = req.params;

    // Validate survey and question exist
    const question = await Question.findByPk(questionId, {
      include: [
        { model: Option, as: "options" },
        { model: Survey, as: "survey" },
      ],
    });
    if (!question || question.surveyId !== surveyId) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Get all answers for this question
    const answers = await ResponseAnswer.findAll({
      where: { questionId },
      include: [
        {
          model: Question,
          as: "question",
          include: [{ model: Option, as: "options" }],
        },
        {
          model: GridResponseAnswer,
          as: "grid_answers",
        },
      ],
    });

    // Calculate answer distribution
    const answerDistribution = {};
    const gridDistribution = {};

    answers.forEach((ans) => {
      // Handle regular answers
      if (ans.answer_value) {
        const value = ans.answer_value;
        answerDistribution[value] = (answerDistribution[value] || 0) + 1;
      }

      // Handle selected options
      if (ans.selected_option_ids) {
        const optionIds = Array.isArray(ans.selected_option_ids)
          ? ans.selected_option_ids
          : [ans.selected_option_ids];
        optionIds.forEach((optId) => {
          answerDistribution[optId] = (answerDistribution[optId] || 0) + 1;
        });
      }

      // Handle grid answers
      if (ans.grid_answers && ans.grid_answers.length > 0) {
        ans.grid_answers.forEach((ga) => {
          const key = `${ga.rowOptionId}-${ga.columnOptionId}`;
          gridDistribution[key] = (gridDistribution[key] || 0) + 1;
        });
      }
    });

    res.json({
      message: "Question results retrieved",
      data: {
        surveyId,
        questionId,
        questionText: question.question_text,
        questionType: question.question_type,
        totalAnswers: answers.length,
        answerDistribution,
        gridDistribution: Object.keys(gridDistribution).length > 0 ? gridDistribution : null,
        options: question.options,
      },
    });
  } catch (error) {
    console.error("Get Question Results Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Export Survey Results (CSV/JSON)
 */
export const exportSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { format = "json" } = req.query;

    // Validate survey exists
    const survey = await Survey.findByPk(surveyId, {
      include: [{ model: Question, as: "questions" }],
    });
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    // Get all responses
    const responses = await Response.findAll({
      where: { surveyId },
      include: [
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            { model: Question, as: "question" },
            { model: GridResponseAnswer, as: "grid_answers" },
          ],
        },
      ],
    });

    if (format === "csv") {
      // Generate CSV
      let csv = "Response ID,Submitted At,Question,Answer\n";
      responses.forEach((r) => {
        if (r.response_answers) {
          r.response_answers.forEach((ans) => {
            const qText = ans.question ? ans.question.question_text : "";
            csv += `"${r.id}","${r.created_at}","${qText}","${ans.answer_value || ""}"\n`;
          });
        }
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="survey_results_${surveyId}.csv"`
      );
      res.send(csv);
    } else {
      // JSON format
      res.json({
        message: "Survey results exported",
        data: {
          surveyId,
          surveyTitle: survey.title,
          exportedAt: new Date(),
          totalResponses: responses.length,
          responses,
        },
      });
    }
  } catch (error) {
    console.error("Export Survey Results Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get Response Details by Response ID
 */
export const getResponseDetails = async (req, res) => {
  try {
    const { surveyId, responseId } = req.params;

    const response = await Response.findByPk(responseId, {
      include: [
        { model: Survey, as: "survey" },
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            { model: Question, as: "question", include: [{ model: Option, as: "options" }] },
            { model: GridResponseAnswer, as: "grid_answers" },
          ],
        },
      ],
    });

    if (!response || response.surveyId !== surveyId) {
      return res.status(404).json({ message: "Response not found" });
    }

    res.json({
      message: "Response details retrieved",
      data: response,
    });
  } catch (error) {
    console.error("Get Response Details Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get Filtered Responses by Answer Value
 */
export const getFilteredResponses = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { questionId, answerValue, page = 1, limit = 10 } = req.query;

    if (!questionId || !answerValue) {
      return res
        .status(400)
        .json({ message: "questionId and answerValue are required" });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Find responses with specific answer
    const responseAnswers = await ResponseAnswer.findAll({
      where: {
        questionId,
        answer_value: answerValue,
      },
      include: [
        {
          model: Response,
          as: "response",
          where: { surveyId },
          required: true,
          include: [
            {
              model: ResponseAnswer,
              as: "response_answers",
              include: [{ model: Question, as: "question" }],
            },
          ],
        },
      ],
      offset,
      limit: parseInt(limit),
    });

    const total = await ResponseAnswer.count({
      where: {
        questionId,
        answer_value: answerValue,
      },
      include: [
        {
          model: Response,
          as: "response",
          where: { surveyId },
          required: true,
        },
      ],
    });

    res.json({
      message: "Filtered responses retrieved",
      data: {
        surveyId,
        questionId,
        filterValue: answerValue,
        totalMatches: total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        responses: responseAnswers.map((ra) => ra.response),
      },
    });
  } catch (error) {
    console.error("Get Filtered Responses Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
