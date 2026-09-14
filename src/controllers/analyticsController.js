import {
  Survey,
  Response,
  Question,
  ResponseAnswer,
  SurveyAudience,
} from "../models/index.js";

/**
 * Get survey-level analytics
 */
export const getSurveyAnalytics = async (req, res) => {
  try {
    const { surveyId } = req.params;

    // Check survey exists
    const survey = await Survey.findByPk(surveyId);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    // Total responses
    const totalResponses = await Response.count({ where: { surveyId } });

    // Total questions
    const totalQuestions = await Question.count({ where: { surveyId } });

    // Optional: calculate average completion rate
    const responses = await Response.findAll({
      where: { surveyId },
      include: [{ model: ResponseAnswer, as: "response_answers" }],
    });

    const avgCompletionRate =
      responses.length === 0 || totalQuestions === 0
        ? 0
        : responses.reduce(
            (acc, r) =>
              acc +
              ((r.response_answers ? r.response_answers.length : 0) / totalQuestions),
            0
          ) / responses.length;

    res.json({ surveyId, totalResponses, totalQuestions, avgCompletionRate });
  } catch (error) {
    console.error("Survey Analytics Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get question-level analytics
 */
export const getQuestionAnalytics = async (req, res) => {
  try {
    const { surveyId, questionId } = req.params;

    let questions;
    const whereClause = questionId ? { id: questionId, surveyId } : { surveyId };

    questions = await Question.findAll({
      where: whereClause,
      include: [{ model: ResponseAnswer, as: "response_answers" }],
    });

    const analytics = questions.map((q) => {
      const answers = q.response_answers || [];
      const totalAnswers = answers.length;

      const answerDistribution = {};
      answers.forEach((a) => {
        const key = a.answer_value || "N/A";
        answerDistribution[key] = (answerDistribution[key] || 0) + 1;
      });

      return {
        questionId: q.id,
        question_text: q.question_text,
        totalAnswers,
        answerDistribution,
      };
    });

    res.json({ surveyId, analytics });
  } catch (error) {
    console.error("Question Analytics Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get audience-level analytics
 */
export const getAudienceAnalytics = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const totalAudience = await SurveyAudience.count({
      where: { surveyId },
    });

    const respondedAudience = await Response.count({
      where: { surveyId },
    });

    res.json({
      surveyId,
      totalAudience,
      respondedAudience,
      responseRate:
        totalAudience === 0 ? 0 : (respondedAudience / totalAudience) * 100,
    });
  } catch (error) {
    console.error("Audience Analytics Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
