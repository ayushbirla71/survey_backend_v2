import { findInnovateMRExactFeasibility } from "./innovateMR/exactFeasibility.js";
import { addSurveyToInnovaeMR } from "./innovateMR/innovateMRSurvey.js";
import { updateInnovateMRJobStatus } from "./innovateMR/updateJobStatus.js";
import { findSurvey96ExactFeasibility } from "./survey96/exactFeasibility.js";
import { addSurveyToSurvey96 } from "./survey96/survey96Survey.js";
import { updateSurvey96JobStatus } from "./survey96/updateJobStatus.js";
import {
  ingestInnovateMRQuestions_v2,
  ingestSurvey96Questions,
} from "./vendorUtils.js";

export const vendorQuestionFetchers = {
  INNOVATEMR: ingestInnovateMRQuestions_v2,
  INNOVATEMR_TEST: ingestInnovateMRQuestions_v2,
  SURVEY96: ingestSurvey96Questions,
};

export const vendorSurveyHandlers = {
  INNOVATEMR: addSurveyToInnovaeMR,
  INNOVATEMR_TEST: addSurveyToInnovaeMR,
  SURVEY96: addSurveyToSurvey96,
};

export const vendorExactFeasibilityHandlers = {
  INNOVATEMR: findInnovateMRExactFeasibility,
  INNOVATEMR_TEST: findInnovateMRExactFeasibility,
  SURVEY96: findSurvey96ExactFeasibility,
};

export const vendorJobStatusUpdateHandlers = {
  INNOVATEMR: updateInnovateMRJobStatus,
  INNOVATEMR_TEST: updateInnovateMRJobStatus,
  SURVEY96: updateSurvey96JobStatus,
};
