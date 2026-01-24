import { response } from "express";
import prisma from "../config/db.js";
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
    } = req.body;

    const survey = await prisma.survey.create({
      data: {
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
      },
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
        }));

        aiGeneratedQuestions = await prisma.aIGeneratedQuestion.createMany({
          data: questionsToCreate,
        });

        // Fetch the created questions to return in response
        aiGeneratedQuestions = await prisma.aIGeneratedQuestion.findMany({
          where: { surveyId: survey.id },
          orderBy: { order_index: "asc" },
        });
      } catch (aiError) {
        console.error("AI Question Generation Error:", aiError);
        aiGenerationError = aiError.message;

        // Generate fallback questions
        try {
          const fallbackQuestions = generateFallbackQuestions(
            { title, categoryOfSurvey },
            5,
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
            }),
          );

          await prisma.aIGeneratedQuestion.createMany({
            data: questionsToCreate,
          });

          aiGeneratedQuestions = await prisma.aIGeneratedQuestion.findMany({
            where: { surveyId: survey.id },
            orderBy: { order_index: "asc" },
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

    const survey = await prisma.survey.create({
      data: {
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
      },
    });

    let aiGeneratedQuestions = [];
    let aiGenerationError = null;

    // Generate AI questions if requested
    if (autoGenerateQuestions) {
      try {
        const surveyCategoryDetails = await prisma.surveyCategory.findUnique({
          where: { id: surveyCategoryId },
          select: { name: true },
        });
        // console.log(
        //   ">>>>> the value of the surveyCategoryDetails is : ",
        //   surveyCategoryDetails
        // );

        // Try to generate questions using GeminiAI
        const generatedQuestions = await generateSurveyQuestionsWithCategory(
          title,
          surveyCategoryDetails.name || "General",
          description,
        );
        console.log("Generated Questions:", generatedQuestions);

        if (!generatedQuestions || generatedQuestions.length === 0) {
          await prisma.survey.update({
            where: { id: survey.id },
            data: { autoGenerateQuestions: false },
          });
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
            // console.log(">>>>>>> QUESTION ----  -> ", question);

            // console.log(">>>>>>> OPTIONS -> ", question.options);

            const response = await createQuestionsWithOptions(
              questionData,
              question.options || [],
              question.categoryId,
              question.rowOptions || [],
              question.columnOptions || [],
            );

            // console.log(">>>>>>> RESPONSE -> ", response);

            const questionWithOptions = await prisma.question.findUnique({
              where: { id: response.id },
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
                // mediaAsset: true,
                category: true,
              },
            });

            return questionWithOptions;
          },
        );

        aiGeneratedQuestions = await Promise.all(questionsToCreatePromises);
      } catch (aiError) {
        console.error("AI Question Generation Error:", aiError);
        aiGenerationError = aiError.message;
      }
    }

    // console.log(
    //   ">>>>>> the value of the AI Generated Questions is : ",
    //   aiGeneratedQuestions
    // );

    const response = {
      message: "Survey created",
      survey,
      ...(autoGenerateQuestions && {
        aiGeneratedQuestions,
        ...(aiGenerationError && { aiGenerationWarning: aiGenerationError }),
      }),
    };
    // console.log("Create Survey Response:", response);

    return res.status(201).json(response);
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
    const surveys = await prisma.survey.findMany({
      where: { userId: req.user.id, is_deleted: false },
      orderBy: { created_at: "desc" },
      include: {
        questions: true,
        share_tokens: true,
        responses: true,
        vendorConfig: true,
      },
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

    const survey = await prisma.survey.findFirst({
      where: { id, is_deleted: false },
      include: {
        questions: {
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
        },
      },
    });

    if (!survey) return res.status(404).json({ message: "Survey not found" });
    // Helper to attach presigned URL
    const attachPresignedUrl = async (mediaAsset) => {
      if (!mediaAsset) return null;
      mediaAsset.url = await generatePresignedUrl(
        process.env.AWS_BUCKET_NAME,
        mediaAsset.url,
      );
      return mediaAsset;
    };

    // Process all nested media assets
    for (const q of survey.questions) {
      // Question main media
      if (q.mediaAsset) {
        await attachPresignedUrl(q.mediaAsset);
      }

      // Options media
      for (const opt of q.options) {
        if (opt.mediaAsset) {
          await attachPresignedUrl(opt.mediaAsset);
        }
      }

      // Row Options media
      for (const row of q.rowOptions) {
        if (row.mediaAsset) {
          await attachPresignedUrl(row.mediaAsset);
        }
      }

      // Column Options media
      for (const col of q.columnOptions) {
        if (col.mediaAsset) {
          await attachPresignedUrl(col.mediaAsset);
        }
      }
    }

    res.json({ survey });
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

    const survey = await prisma.survey.updateMany({
      where: { id, userId: req.user.id, is_deleted: false },
      data: req.body,
    });

    if (survey.count === 0)
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

    const updatedSurvey = await prisma.survey.updateMany({
      where: { id, userId: req.user.id, is_deleted: false },
      // data: { autoGenerateQuestions: autoGenerateQuestions },
      data: req.body,
    });
    console.log(">>>>>> the value of the UPDATED SURVEY is : ", updatedSurvey);

    if (updatedSurvey.count === 0)
      return res
        .status(404)
        .json({ message: "Survey not found or not authorized" });

    const survey = await prisma.survey.findFirst({
      where: { id, userId: req.user.id, is_deleted: false },
    });
    console.log(">>>>>> the value of the SURVEY is : ", survey);

    let aiGeneratedQuestions = [];
    let aiGenerationError = null;

    // Helper to detect if client has gone away
    // const requestAborted = () => req.aborted || req.destroyed;

    if (autoGenerateQuestions) {
      try {
        const surveyCategoryDetails = await prisma.surveyCategory.findUnique({
          where: { id: survey.surveyCategoryId },
          select: { name: true },
        });

        // if (requestAborted()) {
        //   console.log("Request aborted before AI generation");
        // } else {
        // Try to generate questions using GeminiAI
        const generatedQuestions = await generateSurveyQuestionsWithCategory(
          survey.title,
          surveyCategoryDetails.name || "General",
          survey.description,
        );
        console.log(
          ">>>>>>>>>####### the Value of GENERATED QUESTIONS is : ",
          generatedQuestions,
        );

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
              question.columnOptions || [],
            );

            const questionWithOptions = await prisma.question.findUnique({
              where: { id: response.id },
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
                // mediaAsset: true,
                category: true,
              },
            });

            return questionWithOptions;
          },
        );

        aiGeneratedQuestions = await Promise.all(questionsToCreatePromises);
        // }
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

    const survey = await prisma.survey.updateMany({
      where: { id, userId: req.user.id, is_deleted: false },
      data: { is_deleted: true },
    });

    if (survey.count === 0)
      return res
        .status(404)
        .json({ message: "Survey not found or not authorized" });

    res.json({ message: "Survey deleted" });
  } catch (error) {
    console.error("Delete Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
