export const getInnovateMRRedirectUrl = async ({ vendor_token, type }) => {
  try {
    const redirectUrl =
      (type == "COMPLETED"
        ? process.env.INNOVATE_MR_SUCCESS_REDIRECT_URL
        : type == "QUOTA_FULL"
          ? process.env.INNOVATE_MR_QUOTA_FULL_REDIRECT_URL
          : process.env.INNOVATE_MR_TERMINATE_REDIRECT_URL) + vendor_token;

    console.log(">>>>> the value of the REDIRECT URL is : ", redirectUrl);

    return redirectUrl;
  } catch (error) {
    console.error("Get Innovate MR Redirect URL Error : ", error);
    throw new Error("Failed to get the exact Redirect URL from InnovateMR");
  }
};
