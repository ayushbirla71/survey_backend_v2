import { Vendor } from "../models/index.js";
import { vendorSurveyHandlers } from "../utils/vendorResolver.js";

export const pushSurveyToVendor = async (payload) => {
  const { vendorId } = payload;

  const vendor = await Vendor.findByPk(vendorId, {
    attributes: ["key"],
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const vendorKey = vendor.key?.toUpperCase().trim();

  const handler = vendorSurveyHandlers[vendorKey];

  if (!handler) {
    throw new Error(`Survey handler not implemented for ${vendorKey}`);
  }

  return handler(payload);
};
