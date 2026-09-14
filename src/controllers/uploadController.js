import sequelize, {
  MediaAsset,
  Question,
  Option,
  ResponseAnswer,
} from "../models/index.js";
import {
  deleteFromS3,
  generatePresignedUrl,
  uploadToS3,
} from "../utils/uploadToS3.js";

const detectQuestionTypeFromFile = (file) => {
  console.log(">>>>> the  value of the FILE is : ", file);
  const t = file.mimetype.toLowerCase();
  if (t.startsWith("image/")) return "IMAGE";
  if (t.startsWith("video/")) return "VIDEO";
  if (t.startsWith("audio/")) return "AUDIO";
  return "TEXT";
};

export const uploadMedia = async (req, res) => {
  try {
    const { file } = req;
    console.log(">>>>> the value of the FILE is : ", file);
    if (!file) return res.status(400).json({ message: "No file provided" });

    const fileUrl = await uploadToS3(file, "survey_media");
    console.log(">>>>> the value of the FILE URL is : ", fileUrl);

    const meta = { ...file };
    delete meta.buffer;

    const media = await MediaAsset.create({
      type: detectQuestionTypeFromFile(file),
      url: fileUrl,
      uploaded_by: req.user.id,
      meta,
    });

    media.url = await generatePresignedUrl(
      process.env.AWS_BUCKET_NAME,
      media.url
    );

    res.json({ message: "Media uploaded", media });
  } catch (error) {
    console.error("Upload Media Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/media/:mediaId
 */
export const deleteMedia = async (req, res) => {
  const { mediaId } = req.params;

  if (!mediaId) {
    return res.status(400).json({ message: "mediaId is required" });
  }

  try {
    const media = await MediaAsset.findByPk(mediaId);

    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }

    const s3Key = media.url; // stored key, NOT presigned URL

    // DB CLEANUP FIRST (TRANSACTION)
    const transaction = await sequelize.transaction();
    try {
      // 1. Remove media from Question
      await Question.update(
        { mediaId: null, question_type: "TEXT" },
        { where: { mediaId }, transaction }
      );

      // 2. Remove media from Option
      await Option.update(
        { mediaId: null },
        { where: { mediaId }, transaction }
      );

      // 3. Remove media from ResponseAnswer
      await ResponseAnswer.update(
        { mediaId: null },
        { where: { mediaId }, transaction }
      );

      // 4. Delete MediaAsset itself
      await MediaAsset.destroy({
        where: { id: mediaId },
        transaction,
      });

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    // External side-effect LAST
    try {
      await deleteFromS3(s3Key);
    } catch (s3Err) {
      console.error("⚠️ S3 delete failed:", s3Err);
      // DB is already consistent — DO NOT rollback
    }

    return res.json({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("Delete Media Error:", error);
    return res.status(500).json({ message: "Failed to delete media" });
  }
};
