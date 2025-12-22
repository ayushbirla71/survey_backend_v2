import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { deleteMedia, uploadMedia } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/media", protect, uploadMedia);
router.delete("/media/:mediaId", protect, deleteMedia);

export default router;
