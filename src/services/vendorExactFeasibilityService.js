import { vendorExactFeasibilityHandlers } from "../utils/vendorResolver.js";

export const fetchGroupFeasibilityFromVendor = async (payload) => {
  const { vendorDetails } = payload;

  if (!vendorDetails) {
    throw new Error("Vendor not found");
  }

  const vendorKey = vendorDetails.key?.toUpperCase().trim();

  const handler = vendorExactFeasibilityHandlers[vendorKey];

  if (!handler) {
    throw new Error(`Handler not implemented for vendor: ${vendorKey}`);
  }

  return handler(payload);
};
