import { Vendor } from "../models/index.js";
import { vendorRedirectUrlHandlers } from "../utils/vendorResolver.js";

export const getRedirectUrlFromVendor = async (payload) => {
  console.log(">>>> the value of the PAYLOAD is : ", payload);

  const { vendorId } = payload;

  const vendor = await Vendor.findByPk(vendorId, {
    attributes: ["key"],
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const vendorKey = vendor.key?.toUpperCase().trim();

  const handler = vendorRedirectUrlHandlers[vendorKey];

  if (!handler) {
    throw new Error(`Handler not implemented for vendor: ${vendorKey}`);
  }

  return handler(payload);
};
