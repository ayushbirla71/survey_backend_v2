export const getSurvey96RedirectUrl = async ({ vendor_token, type }) => {
  try {
    const redirectUrl =
      (type == "COMPLETED"
        ? process.env.SURVEY96_SUCCESS_REDIRECT_URL
        : type == "QUOTA_FULL"
          ? process.env.SURVEY96_QUOTA_FULL_REDIRECT_URL
          : process.env.SURVEY96_TERMINATE_REDIRECT_URL) + vendor_token;

    console.log(">>>>> the value of the REDIRECT URL is : ", redirectUrl);

    return redirectUrl;
  } catch (error) {
    console.error("Get Survey 96 Redirect URL Error : ", error);
    throw new Error("Failed to get the exact Redirect URL from Survey96.");
  }
};
