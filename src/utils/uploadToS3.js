import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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

async function generateGetSignedUrl(bucketName, key, expiresInSeconds) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });
  return url;
}

// ✅ Upload File Function
export const uploadToS3 = async (file, folder = "uploads") => {
  try {
    const fileExtension = file.originalname.split(".").pop();
    const fileName = `${folder}/${Date.now()}.${fileExtension}`;
    console.log(">>>>> the vale of the FILE NAME is : ", fileName);

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer, // ✅ Required for Multer memory storage
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // ✅ Public File URL
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return fileUrl;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error("Failed to upload file to S3");
  }
};
