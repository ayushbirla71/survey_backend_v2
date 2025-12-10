import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(), // ✅ Required for buffer upload
});
