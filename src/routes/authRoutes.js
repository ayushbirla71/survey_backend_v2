import express from "express";
import {
  register,
  login,
  getAllUsers,
  createUser,
  updateUser,
  toggleUserBlocked,
} from "../controllers/authController.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  loginValidation,
  registerValidation,
} from "../validations/validationSchemas.js";
import { admin_middleware } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/signup", validateRequest(registerValidation), register);
router.post("/login", validateRequest(loginValidation), login);

// ADMIN ROUTES
router.get("/getAllUsers", admin_middleware, getAllUsers);
router.post("/createUser", admin_middleware, createUser);
router.patch("/updateUser/:userId", admin_middleware, updateUser);
router.patch("/toggleUserBlocked/:userId", admin_middleware, toggleUserBlocked);

export default router;
