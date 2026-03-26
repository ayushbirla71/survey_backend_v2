import axios from "axios";
import prisma from "../../config/db.js";
import {
  buildQuotaConditions,
  validateInnovateMRResponse,
} from "../vendorUtils.js";

const prepareInnovaeMRTargetPayload = async (screening) => {
  try {
    console.log(
      ">>>> the value of the SCREENING in prepareInnovaeMRPayload is : ",
      screening,
    );
    if (!screening || !Array.isArray(screening)) return [];

    // extract questionIds without option targets for bulk lookup
    const noTargetIds = screening
      .filter((q) => !q.optionTargets || q.optionTargets.length === 0)
      .map((q) => q.questionId);

    // bulk fetch definitions instead of N queries
    const defs = await prisma.screeningQuestionDefinition.findMany({
      where: { id: { in: noTargetIds } },
    });

    const defsById = Object.fromEntries(defs.map((d) => [d.id, d]));

    const payload = await Promise.all(
      screening.map(async (q) => {
        const hasTargets = q.optionTargets && q.optionTargets.length > 0;
        const vendorQuestionId = parseInt(q.vendorQuestionId);

        if (hasTargets) {
          const opts = q.optionTargets
            .filter((o) => o.target > 0)
            .map((o) => parseInt(o.vendorOptionId));

          return opts.length > 0
            ? { questionId: vendorQuestionId, Options: opts }
            : null;
        }

        const def = defsById[q.questionId];
        if (!def) return null;

        switch (def.question_key) {
          case "AGE":
            return {
              questionId: vendorQuestionId,
              Options: q.buckets.map((b) => `${b.value.min}-${b.value.max}`),
            };
          case "ZIPCODES":
            return {
              questionId: vendorQuestionId,
              Options: q.buckets.flatMap((b) =>
                Array.isArray(b.value) ? b.value : [b.value],
              ),
            };
          default:
            return null;
        }
      }),
    );

    return payload.filter(Boolean);
  } catch (error) {
    console.error("Prepare InnovateMR Payload Error:", error);
    throw new Error("Failed to prepare InnovateMR payload.");
  }
};

export const addSurveyToInnovaeMR = async ({
  survey,
  vendorId,
  totalTarget,
  screening,
  deleteVendorTargets,
}) => {
  try {
    console.log(
      ">>>> the value of the SURVEY in addSurveyToInnovaeMR is : ",
      survey,
    );
    console.log(
      ">>>> the value of the VENDOR ID in addSurveyToInnovaeMR is : ",
      vendorId,
    );
    console.log(
      ">>>> the value of the TOTAL TARGET in addSurveyToInnovaeMR is : ",
      totalTarget,
    );
    console.log(
      ">>>> the value of the SCREENING in addSurveyToInnovaeMR is : ",
      screening,
    );

    const vendorDetails = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        api_configs: { where: { is_default: true, is_active: true } },
      },
    });
    console.log(
      ">>>> the value of the VENDOR DETAILS in addSurveyToInnovaeMR is : ",
      vendorDetails,
    );
    if (!vendorDetails) {
      throw new Error("Vendor not found");
    }
    if (vendorDetails.api_configs.length === 0) {
      throw new Error("No active API config found");
    }

    const apiConfig =
      vendorDetails.api_configs[vendorDetails.api_configs.length - 1];
    const { id: apiConfigId, base_url, credentials } = apiConfig;

    // Check if JOB already created on VENDOR side
    const isSurveyVendorConfigExist = await prisma.surveyVendorConfig.findFirst(
      {
        where: { surveyId: survey.id, vendorId: vendorDetails.id },
      },
    );
    console.log(
      ">>>> the value of the isSurveyVendorConfigExist in addSurveyToInnovaeMR is : ",
      isSurveyVendorConfigExist,
    );

    let job_id = isSurveyVendorConfigExist
      ? JSON.parse(isSurveyVendorConfigExist.vendor_survey_id)
      : null;
    console.log(
      ">>>> the value of the JOB ID in addSurveyToInnovaeMR is : ",
      job_id,
    );

    let surveyVendorConfigId = isSurveyVendorConfigExist
      ? isSurveyVendorConfigExist.id
      : null;
    console.log(
      ">>>> the value of the surveyVendorConfigId in addSurveyToInnovaeMR is : ",
      surveyVendorConfigId,
    );

    if (!job_id) {
      const createJobResponse = await axios.post(
        `${base_url}/pega/job`,
        {
          Name: survey.title,
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
          surveyId: survey.id,
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

    let group_id = isSurveyVendorConfigExist
      ? JSON.parse(isSurveyVendorConfigExist.vendor_group_id)
      : null;

    console.log(
      ">>>>>> the value of the GROUP iD in addSurveyToInnovaeMR is : ",
      group_id,
    );

    if (!group_id) {
      // Adding GROUP to the JOB
      const createGroupResponse = await axios.post(
        `${base_url}/pega/jobs/${job_id}/group`,
        {
          Name: survey.title + " - Group",
          N: totalTarget,
          IncidenceRate: 80,
          EstCostPerInterview: 1,
          MaximumCostPerInterview: 1.8,
          LengthOfInterview: 2,
          LiveSurveyUrl:
            process.env.BACKEND_URL +
            `/webhook/innovate/${survey.id}?tk=[%%token%%]&pid=[%%pid%%]`, // TODO: Add the live survey url
          TestSurveyUrl:
            process.env.BACKEND_URL +
            `/webhook/innovate/${survey.id}?tk=[%%token%%]&pid=[%%pid%%]`, // TODO: Add the test survey url
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

      group_id = createGroupResponse.data?.group?.Id;
      console.log(">>>>> the value of the GROUP ID is : ", group_id);

      const updateSurveyVendorConfig = await prisma.surveyVendorConfig.update({
        where: { id: surveyVendorConfigId },
        data: { vendor_group_id: JSON.stringify(group_id) },
      });
      console.log(
        ">>>>> the value of the updateSurveyVendorConfig is : ",
        updateSurveyVendorConfig,
      );
    } else {
      // Group already created have to update it
      const getGroupDetails = await axios.get(
        `${base_url}/pega/groups/${group_id}`,
        {
          headers: {
            "x-access-token": `${credentials.token}`,
          },
        },
      );
      console.log(
        ">>>>> the value of the GET GROUP DETAILS is : ",
        getGroupDetails.data,
      );
      const group = getGroupDetails.data.group;
      console.log(">>>>>> the value of the GROUP is : ", group);

      const updateGroupPayload = {
        Name: group.Name,
        N: totalTarget,
        IncidenceRate: group.IncidenceRate,
        EstCostPerInterview: group.EstCostPerInterview,
        LengthOfInterview: group.LengthOfInterview,
        LiveSurveyUrl: group.LiveSurveyUrl,
        TestSurveyUrl: group.LiveSurveyUrl,
        Color: 0, // White
        Priority: 0, // Normal
        DeviceType: group.DeviceType,
        Target: { GeoIPCheck: 0, Country: "India", Languages: "ENGLISH" },
        Note: "Some Updates in the Group.",
        MaximumCostPerInterview: group.MaximumCostPerInterview,
      };
      console.log(
        ">>>> the value of the UPDATE GROUP PAYLOAD is : ",
        updateGroupPayload,
      );

      const updateGroup = await axios.put(
        `${base_url}/pega/group/${group_id}`,
        updateGroupPayload,
        {
          headers: {
            "x-access-token": `${credentials.token}`,
          },
        },
      );
      console.log(
        ">>>>> the value of the UPDATE GROUP is : ",
        updateGroup.data,
      );
      const validatedUpdateGroupResponse = validateInnovateMRResponse(
        updateGroup,
        "Update Group",
      );
      console.log(
        ">>>>> the value of the validatedUpdateGroupResponse from INNOVATE MR is : ",
        validatedUpdateGroupResponse,
      );
    }

    const vendorTargetPayload = await prepareInnovaeMRTargetPayload(screening);
    console.log(
      ">>>> the value of the VENDOR TARGET PAYLOAD in distributeOverInnovateMR is : ",
      vendorTargetPayload,
    );

    const is_target_added = isSurveyVendorConfigExist
      ? isSurveyVendorConfigExist.is_target_added
      : false;
    console.log(
      ">>>>> the value of the IS SURVEY ADDED is : ",
      is_target_added,
    );

    if (deleteVendorTargets != null && deleteVendorTargets.length != 0) {
      console.log("@@@@@@@@@@@@@@@@@@@ DELETING VENDOR TARGET.......... ");
      for (const toDeleteTarget of deleteVendorTargets) {
        try {
          const question_key = toDeleteTarget.questionKey;
          console.log(
            ">>>> the value of the QUESTION KEY in REMOVE TARGET is : ",
            question_key,
          );
          const removeVendorTargetResponse = await axios.delete(
            `${base_url}/pega/group/${group_id}/${question_key}`,
            {
              headers: {
                "x-access-token": `${credentials.token}`,
              },
            },
          );
          console.log(
            ">>>> the value of the REMOVE VENDOR target response is : ",
            removeVendorTargetResponse.data,
          );
          const validateRemoveTargetResponse = validateInnovateMRResponse(
            removeVendorTargetResponse,
            "Remove Target",
          );
          console.log(
            ">>>>> the value of the validateRemoveTargetResponse from INNOVATE MR is : ",
            validateRemoveTargetResponse,
          );
        } catch (error) {
          console.error("Remove from Innovate MR Target Error : ", error);
          throw new Error(
            "Failed to Remove the Existing Targets on InnovateMR.",
          );
        }
      }
    }

    for (const target of vendorTargetPayload) {
      try {
        const method = is_target_added ? "put" : "post";

        const createVendorTargetResponse = await axios({
          method,
          url: `${base_url}/pega/group/${group_id}/target`,
          data: {
            QuestionId: target.questionId,
            Options: target.Options,
          },

          headers: {
            "x-access-token": `${credentials.token}`,
          },
          timeout: 10000,
        });
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

    if (!is_target_added) {
      const updateSurveyVendorConfigWithTarget =
        await prisma.surveyVendorConfig.update({
          where: { id: surveyVendorConfigId },
          data: { is_target_added: true },
        });
      console.log(
        ">>>>> the value of the updateSurveyVendorConfigWithTarget is : ",
        updateSurveyVendorConfigWithTarget,
      );
    }

    const conditions = buildQuotaConditions(vendorTargetPayload);
    console.log(
      ">>>> the value of the CONDITIONS in distributeOverInnovateMR is : ",
      conditions,
    );

    let quota_id = isSurveyVendorConfigExist
      ? JSON.parse(isSurveyVendorConfigExist.vendor_quota_id)
      : null;
    console.log(">>>>> the value of the QUOTA ID is : ", quota_id);

    if (!quota_id) {
      const addQuotaToGroupResponse = await axios.post(
        `${base_url}/pega/quota`,
        {
          Title: survey.title + " - Quota",
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

      quota_id = addQuotaToGroupResponse.data?.Quota?.Id;
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
    } else {
      // Quota already exists have to update it
      const getGroupQuota = await axios.get(
        `${base_url}/pega/quotas/${group_id}`,
        {
          headers: {
            "x-access-token": `${credentials.token}`,
          },
        },
      );
      console.log(
        ">>>>> the value of the GET GROUP QUOTA is : ",
        getGroupQuota.data,
      );

      const quotas = getGroupQuota.data.Quotas;
      console.log(">>>>>>> the value of the QUOTAS is : ", quotas);

      const quota = quotas.find((q) => q.Id == quota_id);
      console.log(">>>>>> the value of the QUOTA is : ", quota);

      const updatedQuotaPayload = {
        Title: quota.Title,
        HardStop: quota.HardStop,
        HardStopType: quota.HardStopType,
        N: totalTarget,
        GroupId: quota.GroupId,
        Conditions: conditions,
      };
      console.log(
        ">>>>>> the value of the UPDATE QUOTA PAYLOAD is : ",
        updatedQuotaPayload,
      );

      const updateGroupQuota = await axios.put(
        `${base_url}/pega/quota/${quota_id}`,
        updatedQuotaPayload,
        {
          headers: {
            "x-access-token": `${credentials.token}`,
          },
        },
      );
      console.log(
        ">>>> the value of the UPDATE GROUP QUOTA is : ",
        updateGroupQuota.data,
      );

      const validatedUpdateQuotaToGroupResponse = validateInnovateMRResponse(
        updateGroupQuota,
        "Update Quota to Group",
      );
      console.log(
        ">>>>> the value of the validatedUpdateQuotaToGroupResponse from INNOVATE MR is : ",
        validatedUpdateQuotaToGroupResponse,
      );
    }

    return true;
  } catch (error) {
    console.error("Add Survey to InnovateMR Error:", error);
    throw new Error("Failed to add survey to InnovateMR.");
  }
};
