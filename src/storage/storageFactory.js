import {
  uploadToS3,
  deleteFromS3,
  generateS3PresignedUrl,
} from "./providers/s3Provider.js";

import {
  uploadToGCS,
  deleteFromGCS,
  generateGCSPresignedUrl,
} from "./providers/gcsProvider.js";

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER?.toLowerCase() || "s3";

export const storageProvider = {
  upload: STORAGE_PROVIDER === "gcs" ? uploadToGCS : uploadToS3,

  delete: STORAGE_PROVIDER === "gcs" ? deleteFromGCS : deleteFromS3,

  generateUrl:
    STORAGE_PROVIDER === "gcs"
      ? generateGCSPresignedUrl
      : generateS3PresignedUrl,
};
