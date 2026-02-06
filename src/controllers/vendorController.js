import axios from "axios";
import prisma from "../config/db.js";
import {
  buildQuotaConditions,
  buildVendorTargetPayload,
  ingestInnovateMRQuestions,
  ingestInnovateMRQuestions_v2,
  validateInnovateMRResponse,
} from "../utils/vendorUtils.js";

/**
 * CREATE VENDOR
 */
export const createVendor = async (req, res) => {
  try {
    const { key, name, apiConfig } = req.body;

    if (!key || !name) {
      return res.status(400).json({ message: "key and name are required" });
    }

    const checkVendorExists = await prisma.vendor.findUnique({
      where: { key },
    });
    console.log(
      ">>>>> the value of the CHECK VENDOR exists is : ",
      checkVendorExists,
    );
    if (checkVendorExists)
      return res
        .status(400)
        .send({ message: "Vendor already exists with this KEY." });

    const vendor = await prisma.vendor.create({
      data: { key, name },
    });
    console.log(">>>>> the value of the VENDOR is : ", vendor);

    if (apiConfig) {
      const { api_version, base_url, auth_type, credentials } = apiConfig;
      const config = await prisma.vendorApiConfig.create({
        data: {
          api_version,
          base_url,
          auth_type,
          credentials,
          vendorId: vendor.id,
          is_default: true,
        },
      });
      console.log(">>>>> the value of the CONFIG is : ", config);
    }

    const vendorWithConfig = await prisma.vendor.findUnique({
      where: { id: vendor.id },
      include: { api_configs: true, question_library: true },
    });
    console.log(
      ">>>> the value of the VENDOR WITH CONFIG is : ",
      vendorWithConfig,
    );

    return res
      .status(201)
      .json({ message: "Vendor created successfully", data: vendorWithConfig });
  } catch (error) {
    console.error("Create Vendor Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * LIST VENDORS
 */
export const getVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: { api_configs: true, question_library: true },
    });
    return res.json({
      message: "Vendors retrieved successfully",
      data: vendors,
    });
  } catch (error) {
    console.error("Get Vendors Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { api_configs: true, question_library: true },
    });
    return res.json({ message: "Vendor retrieved successfully", data: vendor });
  } catch (error) {
    console.error("Get Vendors Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * UPDATE VENDOR
 */
export const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const vendor = await prisma.vendor.update({
      where: { id },
      data: { name, is_active },
      include: { api_configs: true, question_library: true },
    });

    return res.json({ message: "Vendor updated successfully", data: vendor });
  } catch (error) {
    console.error("Update Vendor Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * TOGGLE VENDOR STATUS
 */
export const toggleVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const vendor = await prisma.vendor.update({
      where: { id },
      data: { is_active },
      include: { api_configs: true, question_library: true },
    });
    console.log(">>>>> the value of the TOGGLED VENDOR is : ", vendor);

    return res.json({ message: "Vendor toggled successfully", data: vendor });
  } catch (error) {
    console.error("Toggle Vendor Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//  *******************   API CONFIGS   ******************************

/**
 * CREATE API CONFIG
 */
export const createApiConfig = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { api_version, base_url, auth_type, credentials } = req.body;

    if (is_default) {
      // Ensure only ONE default per vendor
      await prisma.vendorApiConfig.updateMany({
        where: { vendorId },
        data: { is_default: false },
      });
    }

    const config = await prisma.vendorApiConfig.create({
      data: {
        vendorId,
        api_version,
        base_url,
        auth_type,
        credentials,
        is_default: !!is_default,
      },
    });

    return res
      .status(201)
      .json({ message: "API Config created successfully", data: config });
  } catch (error) {
    console.error("Create API Config Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * LIST API CONFIGS
 */
export const getAPIConfigsByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const configs = await prisma.vendorApiConfig.findMany({
      where: { vendorId },
    });

    return res.json({
      message: "API Configs retrieved successfully",
      data: configs,
    });
  } catch (error) {
    console.error("Get API Configs Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * UPDATE API CONFIG
 */
export const updateAPIConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { api_version, base_url, auth_type, credentials, is_default } =
      req.body;

    const config = await prisma.vendorApiConfig.update({
      where: { id },
      data: {
        api_version,
        base_url,
        auth_type,
        credentials,
        is_default: !!is_default,
      },
    });

    return res.json({
      message: "API Config updated successfully",
      data: config,
    });
  } catch (error) {
    console.error("Update API Config Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * SET DEFAULT API CONFIG
 */
export const setDefaultAPIConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const config = await prisma.vendorApiConfig.findUnique({ where: { id } });

    if (!config) {
      return res.status(404).json({ message: "Config not found" });
    }

    await prisma.vendorApiConfig.updateMany({
      where: { vendorId: config.vendorId },
      data: { is_default: false },
    });

    const updated = await prisma.vendorApiConfig.update({
      where: { id },
      data: { is_default: true },
    });

    return res.json({
      message: "API Config set as default successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Set Default API Config Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET VENDOR QUESTIONS
 */

export const getSelectedVendorQuestions = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { countryCode, language } = req.query;
    console.log(
      ">>>>> the value of the COUNTRY CODE and LANGUAGE is : ",
      countryCode,
      language,
    );

    const questions = await prisma.vendorQuestionLibrary.findMany({
      where: { vendorId, country_code: countryCode, language },
      include: { category: true, options: true },
    });
    // console.log(">>>>> the value of the QUESTIONS is : ", questions);

    if (questions.length === 0) {
      const apiConfigId = await prisma.vendorApiConfig.findFirst({
        where: { vendorId, is_default: true },
        select: { id: true },
      });
      // console.log(">>>>> the value of the API CONFIG ID is : ", apiConfigId);

      const fetchQuestionsFromVendor = await ingestInnovateMRQuestions({
        vendorId,
        apiConfigId: apiConfigId.id,
        countryCode,
        language,
      });
      // console.log(
      //   ">>>>> the value of the FETCHED QUESTIONS FROM VENDOR is : ",
      //   fetchQuestionsFromVendor
      // );

      const questions = await prisma.vendorQuestionLibrary.findMany({
        where: { vendorId, country_code: countryCode, language },
        include: { category: true, options: true },
      });

      return res.json({
        message: "Vendor Questions retrieved successfully",
        data: questions,
      });
    }

    return res.json({
      message: "Vendor Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("Get Vendor Questions Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getSelectedVendorQuestions_v2 = async (req, res) => {
  try {
    const {
      countryCode = "IN",
      language = "ENGLISH",
      source = "CUSTOM",
      vendorId,
    } = req.query;
    console.log(
      ">>>>> the value of the COUNTRY CODE and LANGUAGE is : ",
      countryCode,
      language,
      source,
      vendorId,
    );

    const findQuestionsWhere = {
      country_code: countryCode,
      language,
    };
    if (source === "VENDOR") {
      findQuestionsWhere.source = "VENDOR";
      findQuestionsWhere.vendorId = vendorId;
    }

    const questions = await prisma.screeningQuestionDefinition.findMany({
      where: findQuestionsWhere,
      include: { options: true },
    });
    console.log(">>>>> the value of the QUESTIONS is : ", questions);

    if (questions.length === 0) {
      if (source === "VENDOR") {
        const apiConfigId = await prisma.vendorApiConfig.findFirst({
          where: { vendorId, is_default: true },
          select: { id: true },
        });
        // console.log(">>>>> the value of the API CONFIG ID is : ", apiConfigId);

        const fetchQuestionsFromVendor = await ingestInnovateMRQuestions_v2({
          vendorId,
          apiConfigId: apiConfigId.id,
          countryCode,
          language,
        });
        // console.log(
        //   ">>>>> the value of the FETCHED QUESTIONS FROM VENDOR is : ",
        //   fetchQuestionsFromVendor
        // );

        const questions = await prisma.screeningQuestionDefinition.findMany({
          where: { vendorId, country_code: countryCode, language },
          include: { options: true },
        });

        return res.json({
          message: "Vendor Questions retrieved successfully",
          data: questions,
        });
      }

      return res.json({
        message: "No questions found",
        data: [],
      });
    }

    return res.json({
      message: "Vendor Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("Get Vendor Questions Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//  *******************   VENDOR DISTRIBUTION   ******************************

const distributeOverInnovateMR = async ({
  surveyDetails,
  vendorDetails,
  totalTarget,
  distribution,
}) => {
  try {
    console.log(
      ">>>> the value of the SURVEY DETAILS in distributeOverInnovateMR is : ",
      surveyDetails,
    );
    console.log(
      ">>>> the value of the VENDOR DETAILS in distributeOverInnovateMR is : ",
      vendorDetails,
    );
    console.log(
      ">>>> the value of the TOTAL TARGET in distributeOverInnovateMR is : ",
      totalTarget,
    );
    console.log(
      ">>>> the value of the DISTRIBUTION in distributeOverInnovateMR is : ",
      distribution,
    );

    // const vendorTargetPayload = await buildVendorTargetPayload(distribution);
    // console.log(
    //   ">>>> the value of the VENDOR TARGET PAYLOAD in distributeOverInnovateMR is : ",
    //   vendorTargetPayload
    // );

    // const conditions = buildQuotaConditions(vendorTargetPayload);
    // console.log(
    //   ">>>> the value of the CONDITIONS in distributeOverInnovateMR is : ",
    //   conditions
    // );

    if (vendorDetails.api_configs.length === 0) {
      throw new Error({ message: "No active API config found" });
    }

    const apiConfig =
      vendorDetails.api_configs[vendorDetails.api_configs.length - 1];
    const { id: apiConfigId, base_url, credentials } = apiConfig;

    const isSurveyVendorConfigExist = await prisma.surveyVendorConfig.findFirst(
      {
        where: { surveyId: surveyDetails.id, vendorId: vendorDetails.id },
      },
    );
    console.log(
      ">>>> the value of the isSurveyVendorConfigExist in distributeOverInnovateMR is : ",
      isSurveyVendorConfigExist,
    );

    let job_id = isSurveyVendorConfigExist
      ? JSON.parse(isSurveyVendorConfigExist.vendor_survey_id)
      : null;
    console.log(
      ">>>> the value of the JOB ID in distributeOverInnovateMR is : ",
      job_id,
    );

    let surveyVendorConfigId = isSurveyVendorConfigExist
      ? isSurveyVendorConfigExist.id
      : null;
    console.log(
      ">>>> the value of the surveyVendorConfigId in distributeOverInnovateMR is : ",
      surveyVendorConfigId,
    );

    if (!job_id) {
      const createJobResponse = await axios.post(
        `${base_url}/pega/job`,
        {
          Name: surveyDetails.title,
          Status: 0,
          Category: 1, // it must me number from 1 to 43
        },
        {
          headers: {
            "x-access-token": `${credentials.token}`,
          },
        },
      );
      console.log(
        ">>>>> the value of the createJobResponse from INNOVATE MR is : ",
        createJobResponse.data,
      );
      const validatedCreateJobResponse = validateInnovateMRResponse(
        createJobResponse,
        "Create Job",
      );
      console.log(
        ">>>>> the value of the validatedCreateJobResponse from INNOVATE MR is : ",
        validatedCreateJobResponse,
      );

      job_id = createJobResponse.data?.job?.Id;
      console.log(">>>>> the value of the JOB ID is : ", job_id);

      const createSurveyVendorConfig = await prisma.surveyVendorConfig.create({
        data: {
          surveyId: surveyDetails.id,
          vendorId: vendorDetails.id,
          api_config_id: apiConfigId,
          vendor_survey_id: JSON.stringify(job_id),
          status: "CREATED",
        },
      });
      console.log(
        ">>>>> the value of the createSurveyVendorConfig is : ",
        createSurveyVendorConfig,
      );

      surveyVendorConfigId = createSurveyVendorConfig.id;
    }

    const createGroupResponse = await axios.post(
      `${base_url}/pega/jobs/${job_id}/group`,
      {
        Name: surveyDetails.title + " - Group Quota",
        N: totalTarget,
        IncidenceRate: 80,
        LengthOfInterview: 2,
        LiveSurveyUrl:
          process.env.BACKEND_URL +
          `/webhook/innovate/${surveyDetails.id}?tk=[%%token%%]&pid=[%%pid%%]`, // TODO: Add the live survey url
        Target: { Country: "India", Languages: "ENGLISH" },
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      },
    );
    console.log(
      ">>>>> the value of the createGroupResponse from INNOVATE MR is : ",
      createGroupResponse.data,
    );
    const validatedCreateGroupResponse = validateInnovateMRResponse(
      createGroupResponse,
      "Create Group",
    );
    console.log(
      ">>>>> the value of the validatedCreateGroupResponse from INNOVATE MR is : ",
      validatedCreateGroupResponse,
    );

    const group_id = createGroupResponse.data?.group?.Id;
    console.log(">>>>> the value of the GROUP ID is : ", group_id);

    const updateSurveyVendorConfig = await prisma.surveyVendorConfig.update({
      where: { id: surveyVendorConfigId },
      data: { vendor_group_id: JSON.stringify(group_id) },
    });
    console.log(
      ">>>>> the value of the updateSurveyVendorConfig is : ",
      updateSurveyVendorConfig,
    );

    const vendorTargetPayload = await buildVendorTargetPayload(distribution);
    console.log(
      ">>>> the value of the VENDOR TARGET PAYLOAD in distributeOverInnovateMR is : ",
      vendorTargetPayload,
    );

    for (const target of vendorTargetPayload) {
      try {
        console.log(">>>> the value of the Target is : ", target);

        const createVendorTargetResponse = await axios.post(
          `${base_url}/pega/group/${group_id}/target`,
          {
            QuestionId: target.questionId,
            Options: target.Options,
          },
          {
            headers: {
              "x-access-token": `${credentials.token}`,
            },
            timeout: 10000,
          },
        );
        console.log(
          ">>>> the value of the createVendorTargetResponse is : ",
          createVendorTargetResponse.data,
        );
        const validatedCreateVendorTargetResponse = validateInnovateMRResponse(
          createVendorTargetResponse,
          "Create Vendor Target",
        );
        console.log(
          ">>>>> the value of the validatedCreateVendorTargetResponse from INNOVATE MR is : ",
          validatedCreateVendorTargetResponse,
        );
      } catch (error) {
        console.error("Distribute Over InnovateMR Error:", error);
        throw new Error("Failed to distribute over InnovateMR.");
      }
    }

    const updateSurveyVendorConfigWithTarget =
      await prisma.surveyVendorConfig.update({
        where: { id: surveyVendorConfigId },
        data: { is_target_added: true },
      });
    console.log(
      ">>>>> the value of the updateSurveyVendorConfigWithTarget is : ",
      updateSurveyVendorConfigWithTarget,
    );

    const conditions = buildQuotaConditions(vendorTargetPayload);
    console.log(
      ">>>> the value of the CONDITIONS in distributeOverInnovateMR is : ",
      conditions,
    );

    const addQuotaToGroupResponse = await axios.post(
      `${base_url}/pega/quota`,
      {
        Title: surveyDetails.title + " - Quota",
        HardStop: true,
        HardStopType: 0,
        N: totalTarget,
        GroupId: group_id,
        Conditions: conditions,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
        timeout: 10000,
      },
    );
    console.log(
      ">>>>> the value of the addQuotaToGroupResponse is : ",
      addQuotaToGroupResponse.data,
    );
    const validatedAddQuotaToGroupResponse = validateInnovateMRResponse(
      addQuotaToGroupResponse,
      "Add Quota to Group",
    );
    console.log(
      ">>>>> the value of the validatedAddQuotaToGroupResponse from INNOVATE MR is : ",
      validatedAddQuotaToGroupResponse,
    );

    const quota_id = addQuotaToGroupResponse.data?.Quota?.Id;
    console.log(">>>>> the value of the QUOTA ID is : ", quota_id);

    const updateSurveyVendorConfigWithQuota =
      await prisma.surveyVendorConfig.update({
        where: { id: surveyVendorConfigId },
        data: { vendor_quota_id: JSON.stringify(quota_id) },
      });
    console.log(
      ">>>>> the value of the updateSurveyVendorConfigWithQuota is : ",
      updateSurveyVendorConfigWithQuota,
    );

    return true;
  } catch (error) {
    console.error("Distribute Over InnovateMR Error:", error);
    throw new Error("Failed to distribute over InnovateMR.");
  }
};

export const createVendorDistribution = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { surveyId, totalTarget, distribution } = req.body;

    const surveyDetails = await prisma.survey.findUnique({
      where: { id: surveyId },
    });
    if (!surveyDetails) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const vendorDetails = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        api_configs: { where: { is_default: true, is_active: true } },
      },
    });
    if (!vendorDetails) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const distributedResponseOverMR = await distributeOverInnovateMR({
      surveyDetails,
      vendorDetails,
      totalTarget,
      distribution,
    });
    console.log(
      ">>>>> the value of the DISTRIBUTED RESPONSE OVER MR is : ",
      distributedResponseOverMR,
    );

    return res.json({
      message: "Vendor Distribution created successfully",
      data: {},
    });
  } catch (error) {
    console.error("Create Vendor Distribution Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ********************  VENDOR JOB STATUS  ******************************

export const updateVendorJobStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { surveyId, status } = req.body;
    console.log(
      ">>>>> the value of the surveyId and vendorId and status is : ",
      surveyId,
      vendorId,
      status,
    );

    const surveyVendorConfigData = await prisma.surveyVendorConfig.findUnique({
      where: { surveyId, vendorId },
      include: { api_config: true },
    });
    console.log(
      ">>>>> the value of the surveyVendorConfigData is : ",
      surveyVendorConfigData,
    );
    if (!surveyVendorConfigData) {
      return res
        .status(404)
        .json({ message: "Survey Vendor Config not found" });
    }

    const job_id = surveyVendorConfigData.vendor_survey_id;
    console.log(">>>>> the value of the JOB ID is : ", job_id);
    const { base_url, credentials } = surveyVendorConfigData.api_config;

    const updateVendorJobStatusResponse = await axios.put(
      `${base_url}/pega/job/${job_id}/status`,
      {
        Status: status,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      },
    );
    console.log(
      ">>>>> the value of the updateVendorJobStatusResponse is : ",
      updateVendorJobStatusResponse.data,
    );
    const validatedUpdateVendorJobStatusResponse = validateInnovateMRResponse(
      updateVendorJobStatusResponse,
      "Update Vendor Job Status",
    );
    console.log(
      ">>>>> the value of the validatedUpdateVendorJobStatusResponse from INNOVATE MR is : ",
      validatedUpdateVendorJobStatusResponse,
    );

    const group_id = surveyVendorConfigData.vendor_group_id;
    console.log(">>>>> the value of the GROUP ID is : ", group_id);

    const updateVendorGroupStatusResponse = await axios.put(
      `${base_url}/pega/group/${group_id}/status`,
      {
        Status: status,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      },
    );
    console.log(
      ">>>>> the value of the updateVendorGroupStatusResponse is : ",
      updateVendorGroupStatusResponse.data,
    );
    const validatedUpdateVendorGroupStatusResponse = validateInnovateMRResponse(
      updateVendorGroupStatusResponse,
      "Update Vendor Group Status",
    );
    console.log(
      ">>>>> the value of the validatedUpdateVendorGroupStatusResponse from INNOVATE MR is : ",
      validatedUpdateVendorGroupStatusResponse,
    );

    const surveyVendorConfig = await prisma.surveyVendorConfig.update({
      where: { surveyId, vendorId },
      data: { status: "LIVE" },
    });
    console.log(
      ">>>>> the value of the surveyVendorConfig is : ",
      surveyVendorConfig,
    );

    return res.json({
      message: "Vendor Job Status updated successfully",
      data: surveyVendorConfig,
    });
  } catch (error) {
    console.error("Update Vendor Job Status Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const redirectVendor = async (req, res) => {
  try {
    const { shareTokenId, isCompleted } = req.query;
    console.log(">>>>> the value of the shareTokenId is : ", shareTokenId);
    console.log(">>>>> the value of the isCompleted is : ", isCompleted);

    const shareToken = await prisma.shareToken.findFirst({
      where: { token_hash: shareTokenId },
    });
    console.log(">>>>> the value of the shareToken is : ", shareToken);
    if (!shareToken) return res.status(400).json({ message: "Invalid Token." });

    const vendor_token = shareToken.vendor_respondent_id.split("_BR_")[0];
    console.log(">>>>> the value of the VENDOR TOKEN is : ", vendor_token);

    const redirectUrl =
      (isCompleted
        ? process.env.INNOVATE_MR_SUCCESS_REDIRECT_URL
        : process.env.INNOVATE_MR_FAILURE_REDIRECT_URL) + vendor_token;
    console.log(">>>>> the value of the REDIRECT URL is : ", redirectUrl);

    const redirectResponse = await axios.get(redirectUrl);
    console.log(
      ">>>>> the value of the redirectResponse is : ",
      redirectResponse.data,
    );

    return res.json({ message: "Redirecting to Vendor", data: redirectUrl });
  } catch (error) {
    console.error("Mark Vendor Respondent Completed Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
