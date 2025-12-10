import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { uploadMedia } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/media", protect, uploadMedia);

export default router;
