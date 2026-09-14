import { AIGeneratedQuestion, Survey, Question } from "../models/index.js";
import { Op } from "sequelize";

/**
 * Get AI generated questions for a survey
 */
export const getAIQuestionsBySurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;

    // Verify survey belongs to user
    const survey = await Survey.findOne({
      where: { id: surveyId, userId: req.user.id, is_deleted: false },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found or not authorized" });
    }

    const aiQuestions = await AIGeneratedQuestion.findAll({
      where: { surveyId },
      order: [["order_index", "ASC"]],
    });

    res.json({ aiQuestions });
  } catch (error) {
    console.error("Get AI Questions Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create AI generated question manually
 */
export const createAIQuestion = async (req, res) => {
  try {
    const data = req.body;

    // Verify survey belongs to user
    const survey = await Survey.findOne({
      where: { id: data.surveyId, userId: req.user.id, is_deleted: false },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found or not authorized" });
    }

    const aiQuestion = await AIGeneratedQuestion.create({
      ...data,
      surveyId: data.surveyId,
    });

    res.status(201).json({ message: "AI question created", aiQuestion });
  } catch (error) {
    console.error("Create AI Question Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update AI generated question
 */
export const updateAIQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Verify question belongs to user's survey
    const aiQuestion = await AIGeneratedQuestion.findOne({
      where: { id },
      include: [
        {
          model: Survey,
          as: "survey",
          where: { userId: req.user.id, is_deleted: false },
        },
      ],
    });

    if (!aiQuestion) {
      return res.status(404).json({ message: "AI question not found or not authorized" });
    }

    await AIGeneratedQuestion.update(data, { where: { id } });
    const updatedQuestion = await AIGeneratedQuestion.findByPk(id);

    res.json({ message: "AI question updated", aiQuestion: updatedQuestion });
  } catch (error) {
    console.error("Update AI Question Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete AI generated question
 */
export const deleteAIQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify question belongs to user's survey
    const aiQuestion = await AIGeneratedQuestion.findOne({
      where: { id },
      include: [
        {
          model: Survey,
          as: "survey",
          where: { userId: req.user.id, is_deleted: false },
        },
      ],
    });

    if (!aiQuestion) {
      return res.status(404).json({ message: "AI question not found or not authorized" });
    }

    await AIGeneratedQuestion.destroy({ where: { id } });

    res.json({ message: "AI question deleted" });
  } catch (error) {
    console.error("Delete AI Question Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Approve AI generated questions and optionally add them to the survey
 */
export const approveAIQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;
    const { addToSurvey = false } = req.query;

    // Verify all questions belong to user's surveys
    const aiQuestions = await AIGeneratedQuestion.findAll({
      where: {
        id: { [Op.in]: questionIds },
      },
      include: [
        {
          model: Survey,
          as: "survey",
          where: { userId: req.user.id, is_deleted: false },
        },
      ],
    });

    if (aiQuestions.length !== questionIds.length) {
      return res.status(404).json({ message: "Some questions not found or not authorized" });
    }

    // Update approval status
    await AIGeneratedQuestion.update(
      {
        is_approved: true,
        is_added_to_survey: addToSurvey === "true",
      },
      {
        where: { id: { [Op.in]: questionIds } },
      }
    );

    // If addToSurvey is true, create actual questions
    if (addToSurvey === "true") {
      const questionsToCreate = aiQuestions.map((aiQ) => ({
        surveyId: aiQ.surveyId,
        question_type: aiQ.question_type,
        question_text: aiQ.question_text,
        order_index: aiQ.order_index,
        required: aiQ.required,
      }));

      await Question.bulkCreate(questionsToCreate);

      // Update survey question count
      for (const aiQ of aiQuestions) {
        await Survey.increment("no_of_questions", {
          by: 1,
          where: { id: aiQ.surveyId },
        });
      }
    }

    res.json({
      message: `${questionIds.length} questions approved${addToSurvey === "true" ? " and added to survey" : ""}`,
      approvedCount: questionIds.length,
    });
  } catch (error) {
    console.error("Approve AI Questions Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Bulk add approved AI questions to survey
 */
export const addAIQuestionsToSurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { questionIds } = req.body;

    // Verify survey belongs to user
    const survey = await Survey.findOne({
      where: { id: surveyId, userId: req.user.id, is_deleted: false },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found or not authorized" });
    }

    // Get approved AI questions
    const aiQuestions = await AIGeneratedQuestion.findAll({
      where: {
        id: { [Op.in]: questionIds },
        surveyId,
        is_approved: true,
        is_added_to_survey: false,
      },
    });

    if (aiQuestions.length === 0) {
      return res.status(400).json({ message: "No approved questions found to add" });
    }

    // Create actual questions
    const questionsToCreate = aiQuestions.map((aiQ) => ({
      surveyId: aiQ.surveyId,
      question_type: aiQ.question_type,
      question_text: aiQ.question_text,
      order_index: aiQ.order_index,
      required: aiQ.required,
    }));

    await Question.bulkCreate(questionsToCreate);

    // Mark AI questions as added
    await AIGeneratedQuestion.update(
      { is_added_to_survey: true },
      { where: { id: { [Op.in]: questionIds } } }
    );

    // Update survey question count
    await Survey.increment("no_of_questions", {
      by: aiQuestions.length,
      where: { id: surveyId },
    });

    res.json({
      message: `${aiQuestions.length} questions added to survey`,
      addedCount: aiQuestions.length,
    });
  } catch (error) {
    console.error("Add AI Questions to Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
