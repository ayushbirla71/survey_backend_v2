import { Vendor } from "../models/index.js";
import { vendorQuestionFetchers } from "../utils/vendorResolver.js";

export const fetchQuestionsFromVendor = async ({
  vendorId,
  apiConfigId,
  countryCode,
  language,
}) => {
  const vendor = await Vendor.findByPk(vendorId, {
    attributes: ["key"],
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
