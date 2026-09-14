import {
  ShareToken,
  Survey,
  Question,
  Option,
  MediaAsset,
  QuestionCategory,
} from "../models/index.js";
import crypto from "crypto";
import { generatePresignedUrl } from "../utils/uploadToS3.js";

/**
 * Generate a random token hash
 */
export const generateTokenHash = () => crypto.randomBytes(20).toString("hex");

/**
 * Share survey
 */
export const shareSurvey = async (req, res) => {
  try {
    const { surveyId, type, recipients, agentUserUniqueIds } = req.body;

    const survey = await Survey.findByPk(surveyId);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    let shareTokens = [];

    if (type === "NONE") {
      const token_hash = generateTokenHash();
      const token = await ShareToken.create({ surveyId, token_hash });
      shareTokens.push(token);
      const publicLink = `${process.env.FRONTEND_URL}/survey/${token.token_hash}`;

      return res.json({
        message: "Survey shared publicly",
        shareLink: publicLink,
        shareCode: token.token_hash,
      });
    } else if (type === "AGENT") {
      for (const agentId of agentUserUniqueIds) {
        const token_hash = generateTokenHash();
        const token = await ShareToken.create({
          surveyId,
          token_hash,
          agentUserUniqueId: agentId,
        });
        shareTokens.push({
          agentUserUniqueId: agentId,
          token_hash: `${process.env.FRONTEND_URL}/survey/${token_hash}`,
        });
      }

      return res.json({
        message: "Survey shared links created for agents",
        tokens: shareTokens,
      });
    }

    if (Array.isArray(recipients)) {
      for (const recipient of recipients) {
        const token_hash = generateTokenHash();
        const tokenData = {
          surveyId,
          token_hash,
          recipient_email: recipient.email,
          recipient_mobile: recipient.mobile_no,
        };
        const token = await ShareToken.create(tokenData);
        shareTokens.push(token);
      }
    }

    res.json({ message: "Survey shared with recipients", shareTokens });
  } catch (error) {
    console.error("Share Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create Survey Test Token
 */
export const createSurveyTestToken = async (req, res) => {
  try {
    const surveyId = req.body.surveyId;
    console.log(">>>>>> the value of the SURVEY ID is  : ", surveyId);

    const survey = await Survey.findByPk(surveyId);
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const shareToken = await ShareToken.findOne({
      where: { surveyId, isTest: true },
    });
    console.log(">>>>> the value of the SHARE TOKEN is : ", shareToken);

    let publicLink = "";
    if (shareToken) {
      publicLink = `${process.env.FRONTEND_URL}/survey/${shareToken.token_hash}`;
    } else {
      const token_hash = generateTokenHash();
      const token = await ShareToken.create({
        surveyId,
        token_hash,
        isTest: true,
      });

      publicLink = `${process.env.FRONTEND_URL}/survey/${token.token_hash}`;
    }

    return res.json({
      message: "Survey shared publicly",
      data: publicLink,
    });
  } catch (error) {
    console.error("Create Survey Test Token Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Validate share token
 */
export const validateToken = async (req, res) => {
  try {
    const { token } = req.params;

    const shareTokenModel = await ShareToken.findOne({
      where: { token_hash: token },
      include: [
        {
          model: Survey,
          as: "survey",
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
        },
      ],
    });

    if (!shareTokenModel) return res.status(404).json({ message: "Invalid Token." });
    const shareToken = shareTokenModel.toJSON();

    if (shareToken.used)
      return res.status(400).json({ message: "Token already used." });

    const questions = shareToken.survey?.questions || [];

    const attachPresignedUrl = async (mediaAsset) => {
      if (!mediaAsset) return null;
      mediaAsset.url = await generatePresignedUrl(
        process.env.AWS_BUCKET_NAME,
        mediaAsset.url
      );
      return mediaAsset;
    };

    for (const q of questions) {
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

    res.json({
      surveyId: shareToken.surveyId,
      survey: shareToken.survey,
      isTest: shareToken.isTest,
    });
  } catch (error) {
    console.error("Validate Token Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Mark token as used after response submission
 */
export const markTokenUsed = async (tokenHash) => {
  try {
    await ShareToken.update(
      { used: true },
      { where: { token_hash: tokenHash, isTest: false } }
    );
  } catch (error) {
    console.error("Mark Token Used Error:", error);
  }
};
