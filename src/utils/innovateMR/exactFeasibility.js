import axios from "axios";
import { validateInnovateMRResponse } from "../vendorUtils.js";

export const findInnovateMRExactFeasibility = async ({
  vendorDetails,
  vendorGroupId,
}) => {
  try {
    const apiConfig =
      vendorDetails.api_configs[vendorDetails.api_configs.length - 1];
    const { id: apiConfigId, base_url, credentials } = apiConfig;

    // Making the AXIOS call on the INNOVATE MR to get the Exact price based on GROUPID
    const getGroupFeasibilityResponse = await axios.get(
      `${base_url}/pega/group/${vendorGroupId}/feasibility`,
      {
        headers: {
          "x-access-token": `${credentials.token}`,
        },
      },
    );
    console.log(
      ">>>>>. the value of the GET GROUP FEASIBILITY response in findInnovateMRExactFeasibility is : ",
      getGroupFeasibilityResponse.data,
    );

    // Validating the Innovate MR response
    const validateGetGroupFeasibiltyResponse = validateInnovateMRResponse(
      getGroupFeasibilityResponse,
      "Get group feasibility",
    );
    console.log(
      ">>>>> the value of the VALIDATE GET GROUP FEASIBILITY response in findInnovateMRExactFeasibility is : ",
      validateGetGroupFeasibiltyResponse,
    );

    return getGroupFeasibilityResponse;
  } catch (error) {
    console.error("Find Innovate MR Exact Feasibility Error : ", error);
    throw new Error(
      "Failed to get the exact cost(feasibility) from InnovateMR",
    );
  }
};
