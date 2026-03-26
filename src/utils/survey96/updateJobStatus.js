import axios from "axios";
import { validateInnovateMRResponse } from "../vendorUtils.js";

export const updateSurvey96JobStatus = async ({
  vendorId,
  base_url,
  credentials,
  job_id,
  group_id,
  status,
}) => {
  try {
    const textStatus = status == 1 ? "ACTIVE" : "DRAFT";

    const updateVendorJobStatusResponse = await axios.put(
      `${base_url}/job/${job_id}/status`,
      {
        status: textStatus,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      },
    );
    console.log(
      ">>>>> the value of the updateVendorJobStatusResponse in updateSurvey96JobStatus is : ",
      updateVendorJobStatusResponse.data,
    );
    const validatedUpdateVendorJobStatusResponse = validateInnovateMRResponse(
      updateVendorJobStatusResponse,
      "Update Vendor Job Status",
    );
    console.log(
      ">>>>> the value of the validatedUpdateVendorJobStatusResponse from SURVEY 96 in updateSurvey96JobStatus is : ",
      validatedUpdateVendorJobStatusResponse,
    );

    const updateVendorGroupStatusResponse = await axios.put(
      `${base_url}/group/${group_id}/status`,
      {
        status: textStatus,
      },
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      },
    );
    console.log(
      ">>>>> the value of the updateVendorGroupStatusResponse in updateSurvey96JobStatus is : ",
      updateVendorGroupStatusResponse.data,
    );
    const validatedUpdateVendorGroupStatusResponse = validateInnovateMRResponse(
      updateVendorGroupStatusResponse,
      "Update Vendor Group Status",
    );
    console.log(
      ">>>>> the value of the validatedUpdateVendorGroupStatusResponse from SURVEY 96 in updateSurvey96JobStatus is : ",
      validatedUpdateVendorGroupStatusResponse,
    );

    return true;
  } catch (error) {
    console.error("Update Survey96 Job Status Error : ", error);
    throw new Error("Failed to update the job status for Survey96.");
  }
};
