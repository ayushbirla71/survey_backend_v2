import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ✅ Create S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function generatePresignedUrl(
  bucketName,
  key,
  expiresInSeconds = 3600
) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });
}

// ✅ Upload File Function
export const uploadToS3 = async (file, folder = "uploads") => {
  try {
    const fileExtension = file.originalname.split(".").pop();
    const fileName = `${folder}/${Date.now()}.${fileExtension}`;

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer, // ✅ Required for Multer memory storage
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    return fileName;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error("Failed to upload file to S3");
  }
};

/** Delete file from S3 */
export const deleteFromS3 = async (key) => {
  if (!key) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    })
  );
};
