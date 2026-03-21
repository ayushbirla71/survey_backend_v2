import axios from "axios";
import prisma from "../../config/db.js";

const prepareSurvey96TargetPayload = async (screening) => {
  try {
    console.log(
      ">>>> the value of the SCREENING in prepareSurvey96TargetPayload is : ",
      screening,
    );
    // console.log(
    //   ">>>>> the value  of the SCREENING (OPTIONS) in prepareSurvey96TargetPayload is : ",
    //   screening[0].optionTargets,
    // );
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
        const vendorQuestionId = q.vendorQuestionId;

        if (hasTargets) {
          const opts = q.optionTargets
            .filter((o) => o.target > 0)
            .map((o) => o.vendorOptionId);

          return opts.length > 0
            ? { question_id: vendorQuestionId, option_ids: opts }
            : null;
        }

        const def = defsById[q.questionId];
        if (!def) return null;

        switch (def.question_key) {
          case "AGE":
            return {
              question_id: vendorQuestionId,
              option_ids: q.buckets.map((b) => `${b.value.min}-${b.value.max}`),
            };
          case "ZIPCODES":
            return {
              question_id: vendorQuestionId,
              option_ids: q.buckets.flatMap((b) =>
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
    console.error("Prepare Survey96 Payload Error:", error);
    throw new Error("Failed to prepare Survey96 payload.");
  }
};

export const addSurveyToSurvey96 = async ({
  survey,
  vendorId,
  totalTarget,
  screening,
  deleteVendorTargets,
}) => {
  try {
    console.log(
      ">>>> the value of the SURVEY in addSurveyToSurvey96 is : ",
      survey,
    );
    console.log(
      ">>>> the value of the VENDOR ID in addSurveyToSurvey96 is : ",
      vendorId,
    );
    console.log(
      ">>>> the value of the TOTAL TARGET in addSurveyToSurvey96 is : ",
      totalTarget,
    );
    console.log(
      ">>>> the value of the SCREENING in addSurveyToSurvey96 is : ",
      screening,
    );

    const vendorDetails = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        api_configs: { where: { is_default: true, is_active: true } },
      },
    });
    console.log(
      ">>>> the value of the VENDOR DETAILS in addSurveyToSurvey96 is : ",
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
      ">>>> the value of the isSurveyVendorConfigExist in addSurveyToSurvey96 is : ",
      isSurveyVendorConfigExist,
    );

    let job_id = isSurveyVendorConfigExist
      ? isSurveyVendorConfigExist.vendor_survey_id
      : null;
    console.log(
      ">>>> the value of the JOB ID in addSurveyToSurvey96 is : ",
      job_id,
    );

    let surveyVendorConfigId = isSurveyVendorConfigExist
      ? isSurveyVendorConfigExist.id
      : null;
    console.log(
      ">>>> the value of the surveyVendorConfigId in addSurveyToSurvey96 is : ",
      surveyVendorConfigId,
    );

    if (!job_id) {
      const createJobResponse = await axios.post(
        `${base_url}/job`,
        {
          name: survey.title,
          status: "DRAFT",
          category: 1, // it must me number from 1 to 43
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
      //   const validatedCreateJobResponse = validateInnovateMRResponse(
      //     createJobResponse,
      //     "Create Job",
      //   );
      //   console.log(
      //     ">>>>> the value of the validatedCreateJobResponse from INNOVATE MR is : ",
      //     validatedCreateJobResponse,
      //   );

      job_id = createJobResponse.data?.data?.id;
      console.log(">>>>> the value of the JOB ID is : ", job_id);

      const createSurveyVendorConfig = await prisma.surveyVendorConfig.create({
        data: {
          surveyId: survey.id,
          vendorId: vendorDetails.id,
          api_config_id: apiConfigId,
          vendor_survey_id: job_id,
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
      ? isSurveyVendorConfigExist.vendor_group_id
      : null;

    console.log(
      ">>>>>> the value of the GROUP iD in addSurveyToSurvey96 is : ",
      group_id,
    );

    if (!group_id) {
      // Adding GROUP to the JOB
      const createGroupResponse = await axios.post(
        `${base_url}/jobs/${job_id}/group`,
        {
          name: survey.title + " - Group",
          required_completes: totalTarget,
          incidence_rate: 80,
          cpi: 1,
          max_cpi: 1.8,
          loi: 2,
          live_survey_url:
            process.env.BACKEND_URL +
            `/webhook/survey96/${survey.id}?tk=[%%token%%]&pid=[%%pid%%]`, // TODO: Add the live survey url
          country_code: "IN",
          language: "ENGLISH",
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
      //   const validatedCreateGroupResponse = validateInnovateMRResponse(
      //     createGroupResponse,
      //     "Create Group",
      //   );
      //   console.log(
      //     ">>>>> the value of the validatedCreateGroupResponse from INNOVATE MR is : ",
      //     validatedCreateGroupResponse,
      //   );

      group_id = createGroupResponse.data?.data?.id;
      console.log(">>>>> the value of the GROUP ID is : ", group_id);

      const updateSurveyVendorConfig = await prisma.surveyVendorConfig.update({
        where: { id: surveyVendorConfigId },
        data: { vendor_group_id: group_id },
      });
      console.log(
        ">>>>> the value of the updateSurveyVendorConfig is : ",
        updateSurveyVendorConfig,
      );
    } else {
      // Group already created have to update it
      const getGroupDetails = await axios.get(
        `${base_url}/groups/${group_id}`,
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
      const group = getGroupDetails.data?.data;
      console.log(">>>>>> the value of the GROUP is : ", group);

      const updateGroupPayload = {
        name: group.name,
        required_completes: totalTarget,
        incidence_rate: group.incidence_rate,
        cpi: group.cpi,
        loi: group.loi,
        live_survey_url: group.live_survey_url,
        test_survey_url: group.live_survey_url,
        // Color: 0, // White
        priority: 1, // Normal
        device_type: group.device_type,
        country_code: "IN",
        language: "ENGLISH",
        notes: "Some Updates in the Group.",
        max_cpi: group.max_cpi,
      };
      console.log(
        ">>>> the value of the UPDATE GROUP PAYLOAD is : ",
        updateGroupPayload,
      );

      const updateGroup = await axios.put(
        `${base_url}/group/${group_id}`,
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
      //   const validatedUpdateGroupResponse = validateInnovateMRResponse(
      //     updateGroup,
      //     "Update Group",
      //   );
      //   console.log(
      //     ">>>>> the value of the validatedUpdateGroupResponse from INNOVATE MR is : ",
      //     validatedUpdateGroupResponse,
      //   );
    }

    const vendorTargetPayload = await prepareSurvey96TargetPayload(screening);
    console.log(
      ">>>> the value of the VENDOR TARGET PAYLOAD in add SURVEY to SURVEY96 is : ",
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
          const question_id = toDeleteTarget.questionId;
          console.log(
            ">>>> the value of the QUESTION ID in REMOVE TARGET is : ",
            question_id,
          );
          const removeVendorTargetResponse = await axios.delete(
            `${base_url}/group/${group_id}/${question_id}`,
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
          //   const validateRemoveTargetResponse = validateInnovateMRResponse(
          //     removeVendorTargetResponse,
          //     "Remove Target",
          //   );
          //   console.log(
          //     ">>>>> the value of the validateRemoveTargetResponse from INNOVATE MR is : ",
          //     validateRemoveTargetResponse,
          //   );
        } catch (error) {
          console.error("Remove from SURVEY96 Target Error : ", error);
          throw new Error("Failed to Remove the Existing Targets on Survey96.");
        }
      }
    }

    for (const target of vendorTargetPayload) {
      try {
        const method = is_target_added ? "put" : "post";

        const createVendorTargetResponse = await axios({
          method,
          url: `${base_url}/group/${group_id}/target`,
          data: {
            question_id: target.question_id,
            option_ids: target.option_ids,
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
        // const validatedCreateVendorTargetResponse = validateInnovateMRResponse(
        //   createVendorTargetResponse,
        //   "Create Vendor Target",
        // );
        // console.log(
        //   ">>>>> the value of the validatedCreateVendorTargetResponse from INNOVATE MR is : ",
        //   validatedCreateVendorTargetResponse,
        // );
      } catch (error) {
        console.error("Distribute Over Survey96 Error:", error);
        throw new Error("Failed to distribute over Survey96.");
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

    const conditions = vendorTargetPayload;
    console.log(
      ">>>> the value of the CONDITIONS in add Survey to Survey96 is : ",
      conditions,
    );

    let quota_id = isSurveyVendorConfigExist
      ? JSON.parse(isSurveyVendorConfigExist.vendor_quota_id)
      : null;
    console.log(">>>>> the value of the QUOTA ID is : ", quota_id);

    if (!quota_id) {
      const addQuotaToGroupResponse = await axios.post(
        `${base_url}/quota`,
        {
          quota_name: survey.title + " - Quota",
          hard_stop: true,
          hard_stop_type: "COMPLETE",
          quota_limit: totalTarget,
          group_id: group_id,
          conditions: conditions,
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
      //   const validatedAddQuotaToGroupResponse = validateInnovateMRResponse(
      //     addQuotaToGroupResponse,
      //     "Add Quota to Group",
      //   );
      //   console.log(
      //     ">>>>> the value of the validatedAddQuotaToGroupResponse from INNOVATE MR is : ",
      //     validatedAddQuotaToGroupResponse,
      //   );

      quota_id = addQuotaToGroupResponse.data?.data?.id;
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
      const getGroupQuota = await axios.get(`${base_url}/quotas/${group_id}`, {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      });
      console.log(
        ">>>>> the value of the GET GROUP QUOTA is : ",
        getGroupQuota.data,
      );

      const quotas = getGroupQuota.data?.data;
      console.log(">>>>>>> the value of the QUOTAS is : ", quotas);

      const quota = quotas.find((q) => q.id == quota_id);
      console.log(">>>>>> the value of the QUOTA is : ", quota);

      const updatedQuotaPayload = {
        quota_name: quota.quota_name,
        hard_stop: quota.hard_stop,
        hard_stop_type: quota.hard_stop_type,
        quota_limit: totalTarget,
        group_id: quota.group_id,
        conditions: conditions,
      };
      console.log(
        ">>>>>> the value of the UPDATE QUOTA PAYLOAD is : ",
        updatedQuotaPayload,
      );

      const updateGroupQuota = await axios.put(
        `${base_url}/quota/${quota_id}`,
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

      //   const validatedUpdateQuotaToGroupResponse = validateInnovateMRResponse(
      //     updateGroupQuota,
      //     "Update Quota to Group",
      //   );
      //   console.log(
      //     ">>>>> the value of the validatedUpdateQuotaToGroupResponse from INNOVATE MR is : ",
      //     validatedUpdateQuotaToGroupResponse,
      //   );
    }

    return true;
  } catch (error) {
    console.error("Add Survey to Survey96 Error:", error);
    throw new Error("Failed to add survey to Survey96.");
  }
};
