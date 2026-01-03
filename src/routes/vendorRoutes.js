import express from "express";
import {
  createApiConfig,
  createVendor,
  createVendorDistribution,
  getAPIConfigsByVendor,
  getSelectedVendorQuestions,
  getSelectedVendorQuestions_v2,
  getVendorById,
  getVendors,
  setDefaultAPIConfig,
  toggleVendor,
  updateAPIConfig,
  updateVendor,
  updateVendorJobStatus,
} from "../controllers/vendorController.js";

const router = express.Router();

// Vendor Routes
router.post("/", createVendor);
router.get("/", getVendors);

// Vendor API Config Routes
router.post("/:vendorId/api-configs", createApiConfig);
router.get("/:vendorId/api-configs", getAPIConfigsByVendor);
// router.get("/:id/api-configs/:apiConfigId", getAPIConfigById);
router.patch("/api-configs/:id", updateAPIConfig);
router.patch("/api-configs/:id/default", setDefaultAPIConfig);

// Vendor Question Library Routes
router.get("/screening-questions", getSelectedVendorQuestions_v2);
router.get("/:vendorId/questions", getSelectedVendorQuestions);

// Create Vendor Distribution Route
router.post("/:vendorId/distribute", createVendorDistribution);

// Vendor Job Routes
router.patch("/:vendorId/updateVendorJobStatus", updateVendorJobStatus);

router.get("/:id", getVendorById);
router.patch("/:id", updateVendor);
router.patch("/:id/toggle", toggleVendor);

export default router;
