import { Storage } from "@google-cloud/storage";

const storage = new Storage();
const bucketName = process.env.GCP_BUCKET_NAME;
const bucket = storage.bucket(bucketName);

export const uploadToGCS = async (file, folder = "uploads") => {
  try {
    const extension = file.originalname.split(".").pop();

    const fileName = `${folder}/${Date.now()}.${extension}`;

    const blob = bucket.file(fileName);

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });

    return fileName;
  } catch (error) {
    console.error("GCS Upload Error:", error);
    throw new Error("Failed to upload file to GCS");
  }
};

export const deleteFromGCS = async (key) => {
  if (!key) return;

  const blob = bucket.file(key);

  // ignoreNotFound prevents crashing if the file was already deleted
  await blob.delete({ ignoreNotFound: true });

  //   if (!key) return;
  //   await bucket.file(key).delete();
};

export const generateGCSPresignedUrl = async (key, expiresInSeconds = 3600) => {
  // ********* Code for PRODUCTION *************
  // const blob = bucket.file(key);

  // const [url] = await blob.getSignedUrl({
  //   version: "v4",
  //   action: "read",
  //   expires: Date.now() + expiresInSeconds * 1000, // GCS expects a timestamp in milliseconds
  // });

  // return url;

  // ********** Code for LOCAL ***************
  return `https://storage.googleapis.com/${bucketName}/${key}`;

  //   const [url] = await bucket.file(key).getSignedUrl({
  //     action: "read",
  //     expires: Date.now() + expiresInSeconds * 1000,
  //   });

  //   return url;
};
