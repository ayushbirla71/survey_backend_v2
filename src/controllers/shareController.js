import prisma from "../config/db.js";
import crypto from "crypto";

/**
 * Generate a random token hash
 */
const generateTokenHash = () => crypto.randomBytes(20).toString("hex");

/**
 * Share survey
 */
export const shareSurvey = async (req, res) => {
  try {
    const { surveyId, type, recipients, agentUserUniqueIds } = req.body;

    // Check survey exists
    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    let shareTokens = [];

    if (type === "NONE") {
      // Create a single public token
      const token_hash = generateTokenHash();
      const token = await prisma.shareToken.create({
        data: { surveyId, token_hash },
      });
      shareTokens.push(token);
      const publicLink = `${process.env.FRONTEND_URL}/survey/${token.token_hash}`;

      return res.json({
        message: "Survey shared publicly",
        shareLink: publicLink,
        shareCode: token.token_hash,
      });
    } else if (type === "AGENT") {
      // Create a token for each agent
      for (const agentId of agentUserUniqueIds) {
        const token_hash = generateTokenHash();
        const token = await prisma.shareToken.create({
          data: { surveyId, token_hash, agentUserUniqueId: agentId },
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

    // Personalized sharing
    for (const recipient of recipients) {
      const token_hash = generateTokenHash();
      const tokenData = {
        surveyId,
        token_hash,
        recipient_email: recipient.email,
        recipient_mobile: recipient.mobile_no,
      };
      const token = await prisma.shareToken.create({ data: tokenData });
      shareTokens.push(token);

      // Optional: send email / WhatsApp message here using your notification service
    }

    res.json({ message: "Survey shared with recipients", shareTokens });
  } catch (error) {
    console.error("Share Survey Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Validate share token
 */
export const validateToken = async (req, res) => {
  try {
    const { token } = req.params;

    const shareToken = await prisma.shareToken.findFirst({
      where: { token_hash: token },
      include: {
        survey: {
          include: {
            questions: {
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
        },
      },
    });
    console.log(">>>>> the value of the SHARE TOKEN is : ", shareToken);

    if (!shareToken) return res.status(404).json({ message: "Invalid Token." });
    if (shareToken.used)
      return res.status(400).json({ message: "Token already used." });

    res.json({ surveyId: shareToken.surveyId, survey: shareToken.survey });
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
    await prisma.shareToken.updateMany({
      where: { token_hash: tokenHash },
      data: { used: true },
    });
  } catch (error) {
    console.error("Mark Token Used Error:", error);
  }
};
