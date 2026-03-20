import prisma from "../config/db.js";
import { vendorQuestionFetchers } from "../utils/vendorResolver.js";

export const fetchQuestionsFromVendor = async ({
  vendorId,
  apiConfigId,
  countryCode,
  language,
}) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { key: true }, // INNOVATEMR / INNOVATEMR / SURVEY96
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const vendorKey = vendor.key?.toUpperCase().trim();

  const fetcher = vendorQuestionFetchers[vendorKey];

  if (!fetcher) {
    throw new Error(`Fetcher not implemented for vendor: ${vendorKey}`);
  }

  return fetcher({
    vendorId,
    apiConfigId,
    countryCode,
    language,
  });
};
