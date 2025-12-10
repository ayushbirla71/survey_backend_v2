import prisma from "../config/db.js";
import { uploadToS3 } from "../utils/uploadToS3.js";

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

    const fileUrl = await uploadToS3(file, "survey96/survey_media");
    console.log(">>>>> the value of the FILE URL is : ", fileUrl);

    const meta = { ...file };
    delete meta.buffer;

    const media = await prisma.mediaAsset.create({
      data: {
        type: detectQuestionTypeFromFile(file),
        url: fileUrl,
        uploaded_by: req.user.id,
        meta,
      },
    });
    console.log(">>>>> the value of the MEDIA is : ", media);

    res.json({ message: "Media uploaded", media });
  } catch (error) {
    console.error("Upload Media Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
