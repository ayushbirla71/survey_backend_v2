import express from "express";
import {
  createApiConfig,
  createVendor,
  createVendorDistribution,
  getAPIConfigsByVendor,
  getSelectedVendorQuestions,
  getVendorById,
  getVendors,
  redirectVendor,
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
router.get("/:id", getVendorById);
router.patch("/:id", updateVendor);
router.patch("/:id/toggle", toggleVendor);

// Vendor Redirect Routes
router.post("/redirect", redirectVendor);

// Vendor API Config Routes
router.post("/:vendorId/api-configs", createApiConfig);
router.get("/:vendorId/api-configs", getAPIConfigsByVendor);
// router.get("/:id/api-configs/:apiConfigId", getAPIConfigById);
router.patch("/api-configs/:id", updateAPIConfig);
router.patch("/api-configs/:id/default", setDefaultAPIConfig);

// Vendor Question Library Routes
router.get("/:vendorId/questions", getSelectedVendorQuestions);

// Create Vendor Distribution Route
router.post("/:vendorId/distribute", createVendorDistribution);

// Vendor Job Routes
router.patch("/:vendorId/updateVendorJobStatus", updateVendorJobStatus);

export default router;
