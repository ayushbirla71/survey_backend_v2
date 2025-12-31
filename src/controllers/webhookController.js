import { generateTokenHash } from "./shareController.js";

export const innovateWebhook = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { tk, pid } = req.query;
    console.log(">>>>> the value of the SURVEY ID is : ", surveyId);
    console.log(">>>>> the value of the TOKEN is : ", tk);
    console.log(">>>>> the value of the PID is : ", pid);

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });
    if (!survey) return res.status(404).json({ message: "Survey not found" });

    const existingToken = await prisma.shareToken.findFirst({
      where: { vendor_respondent_id: tk + "_" + pid },
    });
    console.log(
      ">>>>> the value of the EXISTING TOKEN in innovateWebhook is : ",
      existingToken
    );
    if (existingToken) {
      const surveyLink = `${process.env.FRONTEND_URL}/survey/${existingToken.token_hash}`;
      console.log(
        ">>>>> the value of the SURVEY LINK in innovateWebhook is : ",
        surveyLink
      );
      return res.redirect(surveyLink);
    }

    const token_hash = generateTokenHash();
    const token = await prisma.shareToken.create({
      data: { surveyId, token_hash, vendor_respondent_id: tk + "_" + pid },
    });
    if (!token)
      return res.status(500).json({ message: "Token creation failed" });

    const surveyLink = `${process.env.FRONTEND_URL}/survey/${token_hash}`;
    return res.redirect(surveyLink);
  } catch (error) {
    console.error("Innovate Webhook Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
