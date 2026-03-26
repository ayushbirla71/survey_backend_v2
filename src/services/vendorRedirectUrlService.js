import prisma from "../config/db.js";
import { vendorRedirectUrlHandlers } from "../utils/vendorResolver.js";

export const getRedirectUrlFromVendor = async (payload) => {
  console.log(">>>> the value of the PAYLOAD is : ", payload);

  const { vendorId } = payload;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { key: true }, // INNOVATEMR / INNOVATEMR / SURVEY96
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
