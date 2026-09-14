import { Response, Question, ResponseAnswer } from "../models/index.js";

export const getSurveyReport = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const totalResponses = await Response.count({ where: { surveyId } });
    const questions = await Question.findAll({
      where: { surveyId },
      include: [{ model: ResponseAnswer, as: "response_answers" }],
    });

    res.json({ totalResponses, questions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
