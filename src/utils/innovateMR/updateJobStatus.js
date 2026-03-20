import axios from "axios";
import { validateInnovateMRResponse } from "../vendorUtils.js";

export const updateInnovateMRJobStatus = async ({
  vendorId,
  base_url,
  credentials,
  job_id,
  group_id,
  status,
}) => {
  try {
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
      ">>>>> the value of the updateVendorJobStatusResponse in updateInnovateMRJobStatus is : ",
      updateVendorJobStatusResponse.data,
    );
    const validatedUpdateVendorJobStatusResponse = validateInnovateMRResponse(
      updateVendorJobStatusResponse,
      "Update Vendor Job Status",
    );
    console.log(
      ">>>>> the value of the validatedUpdateVendorJobStatusResponse from INNOVATE MR in updateInnovateMRJobStatus is : ",
      validatedUpdateVendorJobStatusResponse,
    );

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
      ">>>>> the value of the updateVendorGroupStatusResponse in updateInnovateMRJobStatus is : ",
      updateVendorGroupStatusResponse.data,
    );
    const validatedUpdateVendorGroupStatusResponse = validateInnovateMRResponse(
      updateVendorGroupStatusResponse,
      "Update Vendor Group Status",
    );
    console.log(
      ">>>>> the value of the validatedUpdateVendorGroupStatusResponse from INNOVATE MR in updateInnovateMRJobStatus is : ",
      validatedUpdateVendorGroupStatusResponse,
    );

    return true;
  } catch (error) {
    console.error("Update Innovate MR Job Status Error : ", error);
    throw new Error("Failed to update the job status for InnovateMR");
  }
};
