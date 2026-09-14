import {
  Survey,
  SurveyCategory,
  Question,
  Option,
  MediaAsset,
  QuestionCategory,
  Response,
  ShareToken,
  SurveyVendorConfig,
  AIGeneratedQuestion,
  User,
} from "../models/index.js";
import {
  generateSurveyQuestions,
  generateFallbackQuestions,
  generateSurveyQuestionsWithCategory,
} from "../utils/openaiService.js";
import { createQuestionsWithOptions } from "./questionController.js";
import { generatePresignedUrl } from "../utils/uploadToS3.js";

/**
 * Create a new survey
 */
export const createSurvey = async (req, res) => {
  try {
    const {
      title,
      description,
      flow_type,
      survey_send_by,
      settings,
      status,
      scheduled_date,
      scheduled_type,
      surveyCategoryId,
      autoGenerateQuestions,
      categoryOfSurvey,
    } = req.body;

    const survey = await Survey.create({
      title,
      description,
      userId: req.user.id, // comes from JWT middleware
      survey_send_by: survey_send_by || "NONE",
      flow_type: flow_type || "STATIC",
      settings: settings || {},
      status: status || "DRAFT",
      scheduled_date: scheduled_date || null,
      scheduled_type: scheduled_type || "IMMEDIATE",
      surveyCategoryId: surveyCategoryId || null,
      autoGenerateQuestions: autoGenerateQuestions || false,
    });

    let aiGeneratedQuestions = [];
    let aiGenerationError = null;

    // Generate AI questions if requested
    if (autoGenerateQuestions) {
      try {
        const surveyData = {
          title,
          description,
          categoryOfSurvey,
        };

        // Try to generate questions using OpenAI
        const generatedQuestions = await generateSurveyQuestions(surveyData, 5);

        // Save generated questions to database
        const questionsToCreate = generatedQuestions.map((question, index) => ({
          surveyId: survey.id,
          question_type: question.question_type,
          question_text: question.question_text,
          options: question.options || [],
          order_index: index + 1,
          required: question.required || true,
          ai_prompt: question.ai_prompt,
          ai_model: question.ai_model,
          confidence_score: question.confidence_score,
          categoryId: question.categoryId || surveyCategoryId,
        }));

        await AIGeneratedQuestion.bulkCreate(questionsToCreate);

        // Fetch the created questions to return in response
        aiGeneratedQuestions = await AIGeneratedQuestion.findAll({
          where: { surveyId: survey.id },
          order: [["order_index", "ASC"]],
        });
      } catch (aiError) {
        console.error("AI Question Generation Error:", aiError);
        aiGenerationError = aiError.message;

        // Generate fallback questions
        try {
          const fallbackQuestions = generateFallbackQuestions(
            { title, categoryOfSurvey },
            5
          );

          const questionsToCreate = fallbackQuestions.map(
            (question, index) => ({
              surveyId: survey.id,
              question_type: question.question_type,
              question_text: question.question_text,
              options: question.options || [],
              order_index: index + 1,
              required: question.required || true,
              ai_prompt: question.ai_prompt,
              ai_model: question.ai_model,
              confidence_score: question.confidence_score,
              categoryId: question.categoryId || surveyCategoryId,
            })
          );

          await AIGeneratedQuestion.bulkCreate(questionsToCreate);

          aiGeneratedQuestions = await AIGeneratedQuestion.findAll({
            where: { surveyId: survey.id },
            order: [["order_index", "ASC"]],
          });
        } catch (fallbackError) {
          console.error("Fallback Question Generation Error:", fallbackError);
        }
      }
    }

    const response = {
      message: "Survey created",
      survey,
      ...(autoGenerateQuestions && {
        aiGeneratedQuestions,
        ...(aiGenerationError && { aiGenerationWarning: aiGenerationError }),
      }),
    };
    console.log("Create Survey Response:", response);

    res.status(201).json(response);
  } catch (error) {
    console.error("Create Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createSurvey_v2 = async (req, res) => {
  try {
    const {
      title,
      description,
      flow_type,
      survey_send_by,
      settings,
      status,
      scheduled_date,
      scheduled_type,
      surveyCategoryId,
      autoGenerateQuestions,
    } = req.body;

    const survey = await Survey.create({
      title,
      description,
      userId: req.user.id, // comes from JWT middleware
      survey_send_by: survey_send_by || "NONE",
      flow_type: flow_type || "STATIC",
      settings: settings || {},
      status: status || "DRAFT",
      scheduled_date: scheduled_date || null,
      scheduled_type: scheduled_type || "IMMEDIATE",
      surveyCategoryId: surveyCategoryId || null,
      autoGenerateQuestions: autoGenerateQuestions || false,
    });

    let aiGeneratedQuestions = [];
    let aiGenerationError = null;

    // Generate AI questions if requested
    if (autoGenerateQuestions) {
      try {
        const surveyCategoryDetails = await SurveyCategory.findByPk(
          surveyCategoryId,
          { attributes: ["name"] }
        );

        const generatedQuestions = await generateSurveyQuestionsWithCategory(
          title,
          surveyCategoryDetails?.name || "General",
          description
        );
        console.log("Generated Questions:", generatedQuestions);

        if (!generatedQuestions || generatedQuestions.length === 0) {
          await Survey.update(
            { autoGenerateQuestions: false },
            { where: { id: survey.id } }
          );
          throw new Error("No questions generated");
        }

        // Save generated questions to database
        const questionsToCreatePromises = generatedQuestions.map(
          async (question, index) => {
            const questionData = {
              surveyId: survey.id,
              question_type: question.question_type,
              question_text: question.question_text,
              order_index: index + 1,
              required: question.required || true,
              categoryId: question.categoryId,
            };

            const response = await createQuestionsWithOptions(
              questionData,
              question.options || [],
              question.categoryId,
              question.rowOptions || [],
              question.columnOptions || []
            );

            const questionWithOptions = await Question.findByPk(response.id, {
              include: [
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
                { model: QuestionCategory, as: "category" },
              ],
            });

            return questionWithOptions;
          }
        );

        aiGeneratedQuestions = await Promise.all(questionsToCreatePromises);
      } catch (aiError) {
        console.error("AI Question Generation Error:", aiError);
        aiGenerationError = aiError.message;
      }
    }

    const responsePayload = {
      message: "Survey created",
      survey,
      ...(autoGenerateQuestions && {
        aiGeneratedQuestions,
        ...(aiGenerationError && { aiGenerationWarning: aiGenerationError }),
      }),
    };

    return res.status(201).json(responsePayload);
  } catch (error) {
    console.error("Create Survey Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all surveys of logged-in user
 */
export const getSurveys = async (req, res) => {
  try {
    const surveys = await Survey.findAll({
      where: { userId: req.user.id, is_deleted: false },
      order: [["created_at", "DESC"]],
      include: [
        { model: Question, as: "questions" },
        {
          model: ShareToken,
          as: "share_tokens",
          where: { isTest: false },
          required: false,
        },
        { model: Response, as: "responses" },
        { model: SurveyVendorConfig, as: "vendorConfig" },
      ],
    });

    res.json({ surveys });
  } catch (error) {
    console.error("Get Surveys Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get single survey by ID
 */
export const getSurveyById = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findOne({
      where: { id, is_deleted: false },
      include: [
        {
          model: Question,
          as: "questions",
          separate: true,
          order: [["order_index", "ASC"]],
          include: [
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
          ],
        },
      ],
    });

    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const surveyJson = survey.toJSON();

    // Helper to attach presigned URL
    const attachPresignedUrl = async (mediaAsset) => {
      if (!mediaAsset) return null;
      mediaAsset.url = await generatePresignedUrl(
        process.env.AWS_BUCKET_NAME,
        mediaAsset.url
      );
      return mediaAsset;
    };

    // Process all nested media assets
    if (surveyJson.questions) {
      for (const q of surveyJson.questions) {
        if (q.mediaAsset) {
          await attachPresignedUrl(q.mediaAsset);
        }
        if (q.options) {
          for (const opt of q.options) {
            if (opt.mediaAsset) {
              await attachPresignedUrl(opt.mediaAsset);
            }
          }
        }
        if (q.rowOptions) {
          for (const row of q.rowOptions) {
            if (row.mediaAsset) {
              await attachPresignedUrl(row.mediaAsset);
            }
          }
        }
        if (q.columnOptions) {
          for (const col of q.columnOptions) {
            if (col.mediaAsset) {
              await attachPresignedUrl(col.mediaAsset);
            }
          }
        }
      }
    }

    res.json({ survey: surveyJson });
  } catch (error) {
    console.error("Get Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update survey
 */
export const updateSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const [affectedCount] = await Survey.update(req.body, {
      where: { id, userId: req.user.id, is_deleted: false },
    });

    if (affectedCount === 0)
      return res
        .status(404)
        .json({ message: "Survey not found or not authorized" });

    res.json({ message: "Survey updated" });
  } catch (error) {
    console.error("Update Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateSurvey_v2 = async (req, res) => {
  try {
    const { id } = req.params;
    const { autoGenerateQuestions } = req.body;

    const [affectedCount] = await Survey.update(req.body, {
      where: { id, userId: req.user.id, is_deleted: false },
    });
    console.log(">>>>>> the value of the UPDATED SURVEY count is : ", affectedCount);

    if (affectedCount === 0)
      return res
        .status(404)
        .json({ message: "Survey not found or not authorized" });

    const survey = await Survey.findOne({
      where: { id, userId: req.user.id, is_deleted: false },
    });
    console.log(">>>>>> the value of the SURVEY is : ", survey);

    let aiGeneratedQuestions = [];
    let aiGenerationError = null;

    if (autoGenerateQuestions) {
      try {
        const surveyCategoryDetails = await SurveyCategory.findByPk(
          survey.surveyCategoryId,
          { attributes: ["name"] }
        );

        const generatedQuestions = await generateSurveyQuestionsWithCategory(
          survey.title,
          surveyCategoryDetails?.name || "General",
          survey.description
        );
        console.log(
          ">>>>>>>>>####### the Value of GENERATED QUESTIONS is : ",
          generatedQuestions
        );

        const questionsToCreatePromises = generatedQuestions.map(
          async (question, index) => {
            const questionData = {
              surveyId: survey.id,
              question_type: question.question_type,
              question_text: question.question_text,
              order_index: index + 1,
              required: question.required || true,
              categoryId: question.categoryId,
            };

            const response = await createQuestionsWithOptions(
              questionData,
              question.options || [],
              question.categoryId,
              question.rowOptions || [],
              question.columnOptions || []
            );

            const questionWithOptions = await Question.findByPk(response.id, {
              include: [
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
                { model: QuestionCategory, as: "category" },
              ],
            });

            return questionWithOptions;
          }
        );

        aiGeneratedQuestions = await Promise.all(questionsToCreatePromises);
      } catch (aiError) {
        console.error("AI Question Generation Error:", aiError);
        aiGenerationError = aiError.message;
      }
    }

    const responsePayload = {
      message: "Survey updated",
      ...(autoGenerateQuestions && {
        aiGeneratedQuestions,
        ...(aiGenerationError && { aiGenerationWarning: aiGenerationError }),
      }),
    };
    console.log("Update Survey Response:", responsePayload);

    return res.json(responsePayload);
  } catch (error) {
    console.error("Update Survey Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete survey (soft delete)
 */
export const deleteSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const [affectedCount] = await Survey.update(
      { is_deleted: true },
      { where: { id, userId: req.user.id, is_deleted: false } }
    );

    if (affectedCount === 0)
      return res
        .status(404)
        .json({ message: "Survey not found or not authorized" });

    res.json({ message: "Survey deleted" });
  } catch (error) {
    console.error("Delete Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSurveysByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const surveys = await Survey.findAll({
      where: {
        userId: userId,
        is_deleted: false,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        { model: SurveyCategory, as: "surveyCategory" },
        { model: Question, as: "questions" },
        { model: Response, as: "responses" },
      ],
      order: [["created_at", "DESC"]],
    });

    const formattedSurveys = surveys.map((s) => {
      const json = s.toJSON();
      json._count = {
        questions: json.questions ? json.questions.length : 0,
        responses: json.responses ? json.responses.length : 0,
      };
      return json;
    });

    return res.status(200).json({
      success: true,
      total: formattedSurveys.length,
      data: formattedSurveys,
    });
  } catch (error) {
    console.log(">>>>> the error in the getSurveysByUser is : ", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
