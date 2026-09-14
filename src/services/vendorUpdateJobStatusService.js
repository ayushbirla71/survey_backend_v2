import { Vendor } from "../models/index.js";
import { vendorJobStatusUpdateHandlers } from "../utils/vendorResolver.js";

export const updateJobStatusForVendor = async (payload) => {
  const { vendorId } = payload;

  const vendor = await Vendor.findByPk(vendorId, {
    attributes: ["key"],
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const vendorKey = vendor.key?.toUpperCase().trim();

  const handler = vendorJobStatusUpdateHandlers[vendorKey];

  if (!handler) {
    throw new Error(`Handler not implemented for vendor: ${vendorKey}`);
  }

  return handler(payload);
};
