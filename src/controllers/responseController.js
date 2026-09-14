import sequelize, {
  Response,
  ResponseAnswer,
  GridResponseAnswer,
  RankingResponseAnswer,
  Question,
  QuestionCategory,
  Option,
  Survey,
  ShareToken,
  SurveyQuota,
  SurveyQuotaOption,
  SurveyQuotaBucket,
  ScreeningQuestionDefinition,
  ScreenQuestionOption,
  MediaAsset,
} from "../models/index.js";
import { generatePresignedUrl } from "../utils/uploadToS3.js";
import { markTokenUsed } from "./shareController.js";
import { Op } from "sequelize";

/**
 * ✅ Helper: Normalize and prepare answers based on question type
 */
const prepareAnswerData = async (answers) => {
  const preparedAnswers = [];

  for (const a of answers) {
    const question = await Question.findByPk(a.questionId, {
      include: [{ model: QuestionCategory, as: "category" }],
    });

    if (!question) continue;

    const type = question.category?.type_name?.toLowerCase() || "text";

    let answerValue = null;
    let scaleRatingValue = null;
    let mediaLinks = [];
    let selectedOptionIds = null;
    let gridAnswers = [];
    let rankingAnswers = null;

    switch (type) {
      case "short answer":
      case "paragraph":
      case "number":
        answerValue = a.answer_value || "";
        break;

      case "multiple choice":
      case "dropdown":
        selectedOptionIds = Array.isArray(a.answer_value)
          ? [a.answer_value[0]]
          : [a.answer_value];
        break;

      case "checkboxes":
        selectedOptionIds = Array.isArray(a.answer_value)
          ? a.answer_value
          : [a.answer_value];
        break;

      case "linear scale":
      case "rating":
      case "nps":
        selectedOptionIds = a.optionId || null;
        if (!selectedOptionIds)
          scaleRatingValue =
            Number(a.answer_value) == 0 ? 0 : Number(a.answer_value) || null;

        break;

      case "multi-choice grid":
      case "checkbox grid":
        if (Array.isArray(a.answer_value)) {
          for (const row of a.answer_value) {
            const { rowOptionId, selectedColumns = [] } = row;
            for (const colId of selectedColumns) {
              gridAnswers.push({
                rowOptionId,
                columnOptionId: colId,
                selected: true,
              });
            }
          }
        }
        break;

      case "file upload":
        mediaLinks = a.media?.length ? a.media : [];
        break;

      case "date":
      case "time":
        answerValue = a.answer_value || null;
        break;

      case "ranking": {
        if (!Array.isArray(a.answer_value)) break;

        rankingAnswers = a.answer_value.map((optionId, index) => ({
          optionId,
          rank_position: index + 1,
        }));
        break;
      }

      default:
        answerValue = a.answer_value || "";
    }

    preparedAnswers.push({
      questionId: a.questionId,
      answer_type: type,
      answer_value: answerValue,
      media: mediaLinks,
      selected_option_ids: selectedOptionIds,
      scaleRatingValue,
      gridAnswers,
      rankingAnswers,
    });
  }

  return preparedAnswers;
};

const validateRankingAnswer = (question, rankedOptionIds) => {
  const options = question.options || [];
  const optionCount = options.length;

  if (!Array.isArray(rankedOptionIds)) return false;

  const { min_rank_required, max_rank_allowed, allow_partial_rank } = question;

  if (min_rank_required && rankedOptionIds.length < min_rank_required) return false;
  if (max_rank_allowed && rankedOptionIds.length > max_rank_allowed) return false;

  if (!allow_partial_rank && rankedOptionIds.length !== optionCount)
    return false;

  const uniq = new Set(rankedOptionIds);
  if (uniq.size !== rankedOptionIds.length) return false;

  return true;
};

const signMediaAsset = async (mediaAsset) => {
  if (!mediaAsset) return mediaAsset;

  const bucket = process.env.AWS_BUCKET_NAME;
  const key = mediaAsset.url;

  if (!bucket || !key) return mediaAsset;

  mediaAsset.url = await generatePresignedUrl(bucket, key);
  return mediaAsset;
};

const signQuestionMedia = async (q) => {
  if (!q) return;

  if (q.mediaAsset) await signMediaAsset(q.mediaAsset);

  for (const opt of q.options || []) {
    if (opt.mediaAsset) await signMediaAsset(opt.mediaAsset);
  }

  for (const row of q.rowOptions || []) {
    if (row.mediaAsset) await signMediaAsset(row.mediaAsset);
  }

  for (const col of q.columnOptions || []) {
    if (col.mediaAsset) await signMediaAsset(col.mediaAsset);
  }
};

/**
 * Main transaction for creating responses
 */
const createSurveyResponse = async (surveyId, user_metadata, answers) => {
  const formattedAnswers = await prepareAnswerData(answers);

  return await sequelize.transaction(async (t) => {
    const response = await Response.create(
      {
        surveyId,
        user_metadata: user_metadata || {},
      },
      { transaction: t }
    );

    for (const ans of formattedAnswers) {
      const question = await Question.findByPk(ans.questionId, {
        include: [
          { model: Option, as: "options" },
          { model: QuestionCategory, as: "category" },
        ],
        transaction: t,
      });

      if (ans.rankingAnswers && question) {
        const isValid = validateRankingAnswer(
          question,
          ans.rankingAnswers.map((r) => r.optionId)
        );

        if (!isValid) {
          throw new Error("Invalid ranking response");
        }
      }

      const resAnswer = await ResponseAnswer.create(
        {
          responseId: response.id,
          questionId: ans.questionId,
          answer_value: JSON.stringify(ans.answer_value),
          selected_option_ids: ans.selected_option_ids,
          scaleRatingValue: ans.scaleRatingValue,
        },
        { transaction: t }
      );

      if (ans.rankingAnswers?.length) {
        await RankingResponseAnswer.bulkCreate(
          ans.rankingAnswers.map((r) => ({
            responseAnswerId: resAnswer.id,
            optionId: r.optionId,
            rank_position: r.rank_position,
          })),
          { transaction: t }
        );
      }

      if (ans.gridAnswers?.length > 0) {
        await GridResponseAnswer.bulkCreate(
          ans.gridAnswers.map((g) => ({
            responseAnswerId: resAnswer.id,
            rowOptionId: g.rowOptionId,
            columnOptionId: g.columnOptionId,
            selected: g.selected,
          })),
          { transaction: t }
        );
      }
    }

    return await Response.findByPk(response.id, {
      include: [
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            { model: GridResponseAnswer, as: "grid_answers" },
            { model: Question, as: "question" },
          ],
        },
      ],
      transaction: t,
    });
  });
};

/**
 * Submit Response
 */
export const submitResponse = async (req, res) => {
  try {
    const { surveyId, user_metadata, answers } = req.body;
    if (!surveyId || !Array.isArray(answers))
      return res.status(400).json({ message: "Invalid payload" });

    const response = await createSurveyResponse(
      surveyId,
      user_metadata,
      answers
    );
    res.status(201).json({ message: "Response submitted", response });
  } catch (error) {
    console.error("Submit Response Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Submit Response with Token
 */
export const submitResponseWithToken = async (req, res) => {
  try {
    const { token, user_metadata, answers } = req.body;

    const shareToken = await ShareToken.findOne({
      where: { token_hash: token, isTest: false },
      include: [{ model: Survey, as: "survey" }],
    });
    if (!shareToken) return res.status(400).json({ message: "Invalid Token." });
    if (shareToken.used)
      return res.status(400).json({ message: "Token already used." });

    const response = await createSurveyResponse(
      shareToken.surveyId,
      user_metadata,
      answers
    );

    if (
      shareToken.recipient_email ||
      shareToken.recipient_mobile ||
      shareToken.agentUserUniqueId ||
      shareToken.vendor_respondent_id
    )
      await markTokenUsed(token);

    return res.status(201).json({ message: "Response submitted", response });
  } catch (error) {
    console.error("Submit Response With Token Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get Responses
 */
export const getResponsesBySurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const responses = await Response.findAll({
      where: { surveyId },
      include: [
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            { model: GridResponseAnswer, as: "grid_answers" },
            { model: Question, as: "question" },
          ],
        },
      ],
    });
    res.json({ responses });
  } catch (error) {
    console.error("Get Responses Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const surveyModel = await Survey.findByPk(surveyId, {
      include: [
        {
          model: Question,
          as: "questions",
          include: [
            { model: Option, as: "options" },
            { model: Option, as: "rowOptions" },
            { model: Option, as: "columnOptions" },
            { model: QuestionCategory, as: "category" },
          ],
        },
      ],
    });

    if (!surveyModel) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const survey = surveyModel.toJSON();
    const questionIds = (survey.questions || []).map((q) => q.id);

    const totalResponses = await Response.count({
      where: { surveyId },
    });

    const answersModels = await ResponseAnswer.findAll({
      where: { questionId: { [Op.in]: questionIds } },
      include: [{ model: GridResponseAnswer, as: "grid_answers" }],
    });
    const answers = answersModels.map((a) => a.toJSON());

    const byQuestion = new Map();
    for (const a of answers) {
      if (!byQuestion.has(a.questionId)) byQuestion.set(a.questionId, []);
      byQuestion.get(a.questionId).push(a);
    }

    const pct = (num, den) =>
      den > 0 ? Math.round((num / den) * 10000) / 100 : 0;

    const results = [];

    for (const q of survey.questions || []) {
      const type = q.category?.type_name?.toLowerCase?.() || "text";

      const qAnswers = byQuestion.get(q.id) || [];
      const totalAnswers = qAnswers.length;
      const skipped = Math.max(totalResponses - totalAnswers, 0);
      const answerRate = pct(totalAnswers, totalResponses);

      let breakdown = null;
      let rating = null;
      let grid = null;

      if (
        type === "multiple choice" ||
        type === "dropdown" ||
        type === "checkboxes"
      ) {
        const optionCount = new Map((q.options || []).map((o) => [o.id, 0]));

        for (const a of qAnswers) {
          let ids = a.selected_option_ids;
          if (typeof ids === "string") {
            try {
              ids = JSON.parse(ids);
            } catch {
              ids = null;
            }
          }
          if (!Array.isArray(ids)) continue;

          for (const id of ids) {
            if (optionCount.has(id)) {
              optionCount.set(id, optionCount.get(id) + 1);
            }
          }
        }

        breakdown = (q.options || []).map((opt) => {
          const count = optionCount.get(opt.id) || 0;
          return {
            optionId: opt.id,
            label: opt.text ?? "",
            count,
            percent: pct(count, totalAnswers),
          };
        });
      } else if (type === "linear scale" || type === "rating") {
        const valueCount = new Map();
        let sum = 0;
        let n = 0;

        for (const a of qAnswers) {
          if (a.scaleRatingValue != null) {
            const v = Number(a.scaleRatingValue);
            if (!Number.isNaN(v)) {
              valueCount.set(v, (valueCount.get(v) || 0) + 1);
              sum += v;
              n += 1;
            }
          } else if (
            Array.isArray(a.selected_option_ids) &&
            a.selected_option_ids.length
          ) {
            const v = a.selected_option_ids[0];
            valueCount.set(v, (valueCount.get(v) || 0) + 1);
          }
        }

        const distribution = Array.from(valueCount.entries())
          .sort(([a], [b]) => {
            const na = Number(a);
            const nb = Number(b);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return String(a).localeCompare(String(b));
          })
          .map(([value, count]) => ({
            value,
            count,
            percent: pct(count, totalAnswers),
          }));

        const average = n > 0 ? Math.round((sum / n) * 100) / 100 : null;

        rating = {
          average,
          distribution,
        };
      } else if (type === "multi-choice grid" || type === "checkbox grid") {
        const rowColCount = new Map();

        for (const a of qAnswers) {
          for (const g of a.grid_answers || []) {
            if (g.selected) {
              const key = `${g.rowOptionId}__${g.columnOptionId}`;
              rowColCount.set(key, (rowColCount.get(key) || 0) + 1);
            }
          }
        }

        const rows = (q.rowOptions || []).map((row) => {
          const columns = (q.columnOptions || []).map((col) => {
            const count = rowColCount.get(`${row.id}__${col.id}`) || 0;
            return {
              columnOptionId: col.id,
              label: col.text ?? "",
              count,
              percent: pct(count, totalAnswers),
            };
          });

          return {
            rowOptionId: row.id,
            label: row.text ?? "",
            columns,
          };
        });

        grid = { rows };
      }

      results.push({
        questionId: q.id,
        question_text: q.question_text,
        type,
        totalAnswers,
        skipped,
        answerRate,
        breakdown,
        rating,
        grid,
      });
    }

    return res.json({
      surveyId,
      survey,
      totalResponses,
      questions: results,
    });
  } catch (error) {
    console.error("Get Survey Results Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const tryParse = (v) => {
  if (v == null) return null;
  if (Array.isArray(v) || typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

const pct1 = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

const mapType = (type) => {
  const t = (type || "").toLowerCase();
  if (t === "multiple choice" || t === "dropdown") return "single_choice";
  if (t === "checkboxes") return "multiple_choice";
  if (t === "linear scale" || t === "rating" || t === "nps") return "rating";
  if (t === "multi-choice grid" || t === "checkbox grid") return "grid";
  if (t === "short answer" || t === "paragraph" || t === "number")
    return "text";
  if (t === "date") return "date";
  if (t === "time") return "time";
  if (t === "file upload") return "file";
  if (t === "ranking") return "ranking";
  return "text";
};

const fmtDayLabel = (d) => {
  const dt = new Date(d);
  const month = dt.toLocaleString("en-US", { month: "short" });
  const day = dt.getDate();
  return `${month} ${day.toString().padStart(2, "0")}`;
};

const minutesBetween = (start, end) => {
  const ms = new Date(end) - new Date(start);
  return Math.round((ms / 60000) * 10) / 10;
};

export const getSurveyAnalytics = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const surveyModel = await Survey.findByPk(surveyId, {
      include: [
        {
          model: Question,
          as: "questions",
          separate: true,
          order: [["order_index", "ASC"]],
          include: [
            {
              model: Option,
              as: "options",
              include: [{ model: MediaAsset, as: "mediaAsset" }],
            },
            {
              model: Option,
              as: "rowOptions",
              include: [{ model: MediaAsset, as: "mediaAsset" }],
            },
            {
              model: Option,
              as: "columnOptions",
              include: [{ model: MediaAsset, as: "mediaAsset" }],
            },
            { model: QuestionCategory, as: "category" },
            { model: MediaAsset, as: "mediaAsset" },
          ],
        },
        { model: ShareToken, as: "share_tokens" },
        {
          model: SurveyQuota,
          as: "quota",
          include: [
            {
              model: SurveyQuotaOption,
              as: "quota_options",
              include: [
                { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
                { model: ScreenQuestionOption, as: "screeningOption" },
              ],
            },
            {
              model: SurveyQuotaBucket,
              as: "quota_buckets",
              include: [
                { model: ScreeningQuestionDefinition, as: "screeningQuestion" },
              ],
            },
          ],
        },
      ],
    });

    if (!surveyModel) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const survey = surveyModel.toJSON();

    for (const q of survey.questions || []) {
      await signQuestionMedia(q);
    }

    const isPublic = survey.settings?.isResultPublic === true;
    if (!isPublic && !req.user) {
      return res.status(200).json({
        message: "This Survey is private.",
        isPublic: false,
      });
    }

    const responsesModels = await Response.findAll({
      where: { surveyId },
      order: [["created_at", "ASC"]],
      include: [
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            { model: GridResponseAnswer, as: "grid_answers" },
            {
              model: RankingResponseAnswer,
              as: "ranking_answers",
              include: [{ model: Option, as: "option" }],
            },
            {
              model: Question,
              as: "question",
              include: [
                { model: Option, as: "options" },
                { model: Option, as: "rowOptions" },
                { model: Option, as: "columnOptions" },
                { model: QuestionCategory, as: "category" },
              ],
            },
          ],
        },
      ],
    });

    const responses = responsesModels.map((r) => r.toJSON());
    const totalResponses = responses.length;

    const requiredQIds = (survey.questions || [])
      .filter((q) => q.required)
      .map((q) => q.id);

    const isComplete = (resp) => {
      if (!requiredQIds.length) return true;
      const answered = new Set(
        (resp.response_answers || []).map((a) => a.questionId)
      );
      return requiredQIds.every((id) => answered.has(id));
    };

    const completedCount = responses.filter(isComplete).length;
    const shareTokensCount = (survey.share_tokens || []).length;
    const completionRate =
      survey.survey_send_by === "NONE"
        ? 100
        : pct1(completedCount, shareTokensCount);

    const perResponseTimes = responses
      .map((r) => {
        const times = (r.response_answers || []).map(
          (a) => a.submitted_at || r.created_at
        );
        if (!times.length) return 0;
        const earliest = times.reduce(
          (min, t) => (new Date(t) < new Date(min) ? t : min),
          times[0]
        );
        const latest = times.reduce(
          (max, t) => (new Date(t) > new Date(max) ? t : max),
          times[0]
        );
        return minutesBetween(earliest, latest);
      })
      .filter((v) => typeof v === "number");

    const avgTime = perResponseTimes.length
      ? Math.round(
          (perResponseTimes.reduce((s, v) => s + v, 0) /
            perResponseTimes.length) *
            10
        ) / 10
      : 0;

    const answersByQuestion = new Map();
    for (const r of responses) {
      for (const a of r.response_answers || []) {
        if (!answersByQuestion.has(a.questionId))
          answersByQuestion.set(a.questionId, []);
        answersByQuestion.get(a.questionId).push(a);
      }
    }

    const npsCandidates = [];
    const isNpsCategory = (q) => {
      const t = q.category?.type_name?.toLowerCase?.() || "";
      return t.includes("nps") || t.includes("net promoter");
    };

    const seems0to10 = (q) => {
      const qt = q.category?.type_name?.toLowerCase?.() || "";
      const ratingLike = qt === "rating" || qt === "linear scale";
      const has0to10Option = (q.options || []).some((o) => {
        if (typeof o.text === "string") {
          const num = Number(o.text.trim());
          return !Number.isNaN(num) && num >= 0 && num <= 10;
        }
        return false;
      });
      return ratingLike && has0to10Option;
    };

    const questionResults = [];
    const npsScores = [];

    for (const q of survey.questions || []) {
      const rawType = q.category?.type_name || "text";
      const uiType = mapType(rawType);
      const isRanking = rawType.toLowerCase() === "ranking";

      const qa = answersByQuestion.get(q.id) || [];
      const responsesCount = qa.length;

      if (uiType === "single_choice" || uiType === "multiple_choice") {
        const counts = new Map((q.options || []).map((o) => [o.id, 0]));
        for (const a of qa) {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          for (const id of ids)
            if (counts.has(id)) counts.set(id, counts.get(id) + 1);
        }
        const data = (q.options || []).map((o) => ({
          option: o.text ?? "",
          count: counts.get(o.id) || 0,
          percentage: pct1(counts.get(o.id) || 0, responsesCount),
        }));
        questionResults.push({
          question: q.question_text,
          type: rawType,
          responses: responsesCount,
          data,
        });
      } else if (uiType === "rating") {
        const valueCount = new Map();
        let sum = 0;
        let n = 0;

        for (const a of qa) {
          let v = null;
          if (a.scaleRatingValue != null) {
            v = Number(a.scaleRatingValue);
          } else {
            const av = tryParse(a.answer_value);
            if (typeof av === "number") v = av;
            else if (
              typeof av === "string" &&
              av.trim() !== "" &&
              !Number.isNaN(Number(av))
            )
              v = Number(av);
            else {
              let ids = tryParse(a.selected_option_ids);
              if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
              if (ids.length) {
                const opt = (q.options || []).find((o) => o.id === ids[0]);
                if (opt?.text && !Number.isNaN(Number(opt.text)))
                  v = Number(opt.text);
              }
            }
          }
          if (typeof v === "number" && !Number.isNaN(v)) {
            valueCount.set(String(v), (valueCount.get(String(v)) || 0) + 1);
            sum += v;
            n += 1;
          }
        }

        const data = Array.from(valueCount.entries())
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([rating, count]) => ({ rating, count }));
        const averageRating = n ? Math.round((sum / n) * 10) / 10 : 0;

        if (isNpsCategory(q) || seems0to10(q)) {
          const npsVals = [];
          for (const [k, c] of valueCount.entries()) {
            const num = Number(k);
            if (!Number.isNaN(num)) {
              for (let i = 0; i < c; i++) npsVals.push(num);
            }
          }
          npsCandidates.push(...npsVals);
        }

        const isNPS = rawType?.toLowerCase() === "nps";

        if (isNPS) {
          const total = responsesCount;
          let detractors = 0;
          let passives = 0;
          let promoters = 0;

          for (const [rating, count] of valueCount.entries()) {
            const r = Number(rating);
            if (r >= 0 && r <= 6) detractors += count;
            else if (r >= 7 && r <= 8) passives += count;
            else if (r >= 9 && r <= 10) promoters += count;
          }

          const detractorsPercent =
            total > 0 ? Math.round((detractors / total) * 100) : 0;
          const passivesPercent =
            total > 0 ? Math.round((passives / total) * 100) : 0;
          const promotersPercent =
            total > 0 ? Math.round((promoters / total) * 100) : 0;
          const npsScore =
            total > 0
              ? Math.round(((promoters - detractors) / total) * 100)
              : 0;

          npsScores.push(npsScore);

          const distributionData = data.map(({ rating, count }) => ({
            score: rating,
            count: count,
          }));

          questionResults.push({
            question: q.question_text,
            type: rawType,
            responses: responsesCount,
            averageRating,
            npsScore,
            data: {
              detractors: detractorsPercent,
              passives: passivesPercent,
              promoters: promotersPercent,
            },
            distributionData,
          });
        } else {
          questionResults.push({
            question: q.question_text,
            type: rawType,
            responses: responsesCount,
            averageRating,
            data,
          });
        }
      } else if (uiType === "grid") {
        const cellCounts = new Map();
        for (const a of qa) {
          for (const g of a.grid_answers || []) {
            if (g.selected) {
              const key = `${g.rowOptionId}__${g.columnOptionId}`;
              cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
            }
          }
        }
        const data = (q.rowOptions || []).map((row) => ({
          row: row.text ?? "",
          cells: (q.columnOptions || []).map((col) => {
            const count = cellCounts.get(`${row.id}__${col.id}`) || 0;
            return {
              column: col.text ?? "",
              count,
              percentage: pct1(count, responsesCount),
            };
          }),
        }));
        questionResults.push({
          question: q.question_text,
          type: rawType,
          responses: responsesCount,
          data,
        });
      } else if (isRanking) {
        const optionStats = new Map();

        for (const opt of q.options || []) {
          optionStats.set(opt.id, {
            optionId: opt.id,
            label: opt.text ?? "",
            mediaAsset: opt.mediaAsset,
            totalRank: 0,
            count: 0,
            rankDistribution: {},
          });
        }

        for (const a of qa) {
          for (const r of a.ranking_answers || []) {
            const stat = optionStats.get(r.optionId);
            if (!stat) continue;

            stat.totalRank += r.rank_position;
            stat.count += 1;
            stat.rankDistribution[r.rank_position] =
              (stat.rankDistribution[r.rank_position] || 0) + 1;
          }
        }

        const rankingResults = Array.from(optionStats.values()).map((s) => ({
          optionId: s.optionId,
          label: s.label,
          mediaAsset: s.mediaAsset,
          averageRank:
            s.count > 0
              ? Math.round((s.totalRank / s.count) * 100) / 100
              : null,
          responses: s.count,
          rankDistribution: s.rankDistribution,
        }));

        questionResults.push({
          question: q.question_text,
          type: rawType,
          responses: responsesCount,
          ranking: rankingResults,
        });
      } else {
        const isNumber = rawType?.toLowerCase() === "number";

        if (isNumber) {
          const numbers = qa
            .map((a) => {
              const val = tryParse(a.answer_value);
              const num = Number(val);
              return !Number.isNaN(num) ? num : null;
            })
            .filter((v) => v !== null);

          if (numbers.length > 0) {
            const sum = numbers.reduce((acc, n) => acc + n, 0);
            const average = Math.round((sum / numbers.length) * 100) / 100;
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            const min = sortedNumbers[0];
            const max = sortedNumbers[sortedNumbers.length - 1];
            const median =
              sortedNumbers.length % 2 === 0
                ? (sortedNumbers[sortedNumbers.length / 2 - 1] +
                    sortedNumbers[sortedNumbers.length / 2]) /
                  2
                : sortedNumbers[Math.floor(sortedNumbers.length / 2)];

            questionResults.push({
              question: q.question_text,
              type: rawType,
              responses: qa.length,
              average,
              data: {
                min,
                max,
                median,
              },
            });
          } else {
            questionResults.push({
              question: q.question_text,
              type: rawType,
              responses: qa.length,
              average: null,
              data: {
                min: null,
                max: null,
                median: null,
              },
            });
          }
        } else {
          let sampleResponses = [];
          if (uiType === "text") {
            const texts = qa
              .map((a) => {
                const val = tryParse(a.answer_value);
                if (typeof val === "string") return val;
                if (val != null) return String(val);
                return null;
              })
              .filter((v) => typeof v === "string" && v.trim() !== "");
            const sorted = qa
              .map((a) => ({ t: a.submitted_at, v: tryParse(a.answer_value) }))
              .filter((x) => typeof x.v === "string" && x.v.trim() !== "")
              .sort((x, y) => new Date(y.t) - new Date(x.t))
              .slice(0, 5)
              .map((x) => x.v);
            sampleResponses = sorted.length ? sorted : texts.slice(0, 5);
          }

          questionResults.push({
            question: q.question_text,
            type: rawType,
            responses: qa.length,
            ...(uiType === "text" ? { sampleResponses } : {}),
          });
        }
      }
    }

    const overallNpsScore =
      npsScores.length > 0
        ? Math.round(
            npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length
          )
        : 0;

    const ratingMaxByQuestion = new Map();
    for (const q of survey.questions || []) {
      const qt = mapType(q.category?.type_name);
      if (qt === "rating") {
        const numericOptions = (q.options || [])
          .map((o) => Number(o.text))
          .filter((n) => !Number.isNaN(n));
        const rangeTos = (q.options || [])
          .map((o) => o.rangeTo)
          .filter((n) => typeof n === "number");
        const maxOpt = numericOptions.length
          ? Math.max(...numericOptions)
          : null;
        const maxRange = rangeTos.length ? Math.max(...rangeTos) : null;
        ratingMaxByQuestion.set(q.id, maxOpt ?? maxRange ?? 5);
      }
    }

    const individualResponses = responses.map((r) => {
      const times = (r.response_answers || []).map(
        (a) => a.submitted_at || r.created_at
      );
      const earliest = times.length
        ? times.reduce(
            (min, t) => (new Date(t) < new Date(min) ? t : min),
            times[0]
          )
        : r.created_at;
      const latest = times.length
        ? times.reduce(
            (max, t) => (new Date(t) > new Date(max) ? t : max),
            times[0]
          )
        : r.created_at;
      const completionTime = minutesBetween(earliest, latest);

      const answers = (r.response_answers || []).map((a) => {
        const q = a.question;
        const uiType = mapType(q?.category?.type_name);
        let answer = "";

        if (uiType === "single_choice" || uiType === "multiple_choice") {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          const labels = ids
            .map((id) => (q?.options || []).find((o) => o.id === id)?.text ?? "")
            .filter(Boolean);
          answer =
            uiType === "single_choice" ? (labels[0] ?? "") : labels.join(", ");
        } else if (uiType === "rating") {
          let v =
            a.scaleRatingValue != null ? Number(a.scaleRatingValue) : null;
          if (v == null) {
            const av = tryParse(a.answer_value);
            if (typeof av === "number") v = av;
            else if (
              typeof av === "string" &&
              av.trim() !== "" &&
              !Number.isNaN(Number(av))
            )
              v = Number(av);
            else {
              let ids = tryParse(a.selected_option_ids);
              if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
              if (ids.length) {
                const opt = (q?.options || []).find((o) => o.id === ids[0]);
                if (opt?.text && !Number.isNaN(Number(opt.text)))
                  v = Number(opt.text);
              }
            }
          }
          answer = v != null ? `${v}` : "";
        } else if (uiType === "grid") {
          const parts = [];
          for (const g of a.grid_answers || []) {
            if (!g.selected) continue;
            const row =
              (q?.rowOptions || []).find((o) => o.id === g.rowOptionId)?.text ?? "";
            const col =
              (q?.columnOptions || []).find((o) => o.id === g.columnOptionId)?.text ?? "";
            if (row || col) parts.push(`${row}: ${col}`);
          }
          answer = parts.join("; ");
        } else if (
          uiType === "text" ||
          uiType === "date" ||
          uiType === "time"
        ) {
          const val = tryParse(a.answer_value);
          answer =
            typeof val === "string" ? val : val != null ? String(val) : "";
        } else if (uiType === "file") {
          answer = a.mediaId ? `file:${a.mediaId}` : "";
        } else {
          const val = tryParse(a.answer_value);
          answer =
            typeof val === "string" ? val : val != null ? String(val) : "";
        }

        return { question: q?.question_text || "", answer };
      });

      return {
        id: r.id,
        submittedAt: new Date(latest)
          .toISOString()
          .slice(0, 16)
          .replace("T", " "),
        completionTime,
        answers,
      };
    });

    const byDay = new Map();
    for (const r of responses) {
      const label = fmtDayLabel(r.created_at);
      byDay.set(label, (byDay.get(label) || 0) + 1);
    }
    const responseTimeline = Array.from(byDay.entries())
      .sort((a, b) => {
        const [aMon, aDay] = a[0].split(" ");
        const [bMon, bDay] = b[0].split(" ");
        const aD = new Date(`${aMon} ${aDay}, ${new Date().getFullYear()}`);
        const bD = new Date(`${bMon} ${bDay}, ${new Date().getFullYear()}`);
        return aD - bD;
      })
      .map(([date, count]) => ({ date, responses: count }));

    const payload = {
      title: survey.title,
      description: survey.description || "",
      stats: {
        totalResponses,
        completionRate,
        avgTime,
        npsScore: overallNpsScore,
      },
      quota: {
        target_count: survey.quota?.target_count,
        current_count: survey.quota?.current_count,
        qualified_count: survey.quota?.qualified_count,
        terminated_count: survey.quota?.terminated_count,
        quota_full_count: survey.quota?.quota_full_count,

        quota_options:
          survey.quota?.quota_options?.map((q) => ({
            id: q.id,
            question: {
              id: q.screeningQuestion?.id,
              question_key: q.screeningQuestion?.question_key,
              question_text: q.screeningQuestion?.question_text,
              question_type: q.screeningQuestion?.question_type,
            },
            option: {
              id: q.screeningOption?.id,
              text: q.screeningOption?.option_text,
              vendor_option_id: q.screeningOption?.vendor_option_id,
            },
            target_count: q.target_count,
            current_count: q.current_count,
            completion_percentage:
              q.target_count > 0
                ? Math.round((q.current_count / q.target_count) * 100)
                : 0,
          })) || [],

        quota_buckets:
          survey.quota?.quota_buckets?.map((b) => ({
            id: b.id,
            label: b.label,
            question: {
              id: b.screeningQuestion?.id,
              question_text: b.screeningQuestion?.question_text,
            },
            operator: b.operator,
            value: b.value,
            target_count: b.target_count,
            current_count: b.current_count,
            completion_percentage:
              b.target_count > 0
                ? Math.round((b.current_count / b.target_count) * 100)
                : 0,
          })) || [],
      },
      questionResults,
      individualResponses,
      responseTimeline,
    };

    return res.json(payload);
  } catch (err) {
    console.error("getSurveyAnalytics error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const exportSurveyAnalytics = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const surveyModel = await Survey.findByPk(surveyId, {
      include: [
        {
          model: Question,
          as: "questions",
          separate: true,
          order: [["order_index", "ASC"]],
          include: [
            { model: Option, as: "options" },
            { model: Option, as: "rowOptions" },
            { model: Option, as: "columnOptions" },
            { model: QuestionCategory, as: "category" },
          ],
        },
      ],
    });

    if (!surveyModel) {
      return res.status(404).json({ message: "Survey not found" });
    }
    const survey = surveyModel.toJSON();

    const responsesModels = await Response.findAll({
      where: { surveyId },
      order: [["created_at", "ASC"]],
      include: [
        {
          model: ResponseAnswer,
          as: "response_answers",
          include: [
            { model: GridResponseAnswer, as: "grid_answers" },
            {
              model: Question,
              as: "question",
              include: [
                { model: Option, as: "options" },
                { model: Option, as: "rowOptions" },
                { model: Option, as: "columnOptions" },
                { model: QuestionCategory, as: "category" },
              ],
            },
          ],
        },
      ],
    });

    const responses = responsesModels.map((r) => r.toJSON());
    const totalResponses = responses.length;

    const requiredQIds = (survey.questions || [])
      .filter((q) => q.required)
      .map((q) => q.id);

    const isComplete = (resp) => {
      if (!requiredQIds.length) return true;
      const answered = new Set(
        (resp.response_answers || []).map((a) => a.questionId)
      );
      return requiredQIds.every((id) => answered.has(id));
    };

    const completedCount = responses.filter(isComplete).length;
    const completionRate = Math.round(pct1(completedCount, totalResponses));

    const perResponseTimes = responses
      .map((r) => {
        const times = (r.response_answers || []).map(
          (a) => a.submitted_at || r.created_at
        );
        if (!times.length) return 0;
        const earliest = times.reduce(
          (min, t) => (new Date(t) < new Date(min) ? t : min),
          times[0]
        );
        const latest = times.reduce(
          (max, t) => (new Date(t) > new Date(max) ? t : max),
          times[0]
        );
        return minutesBetween(earliest, latest);
      })
      .filter((v) => typeof v === "number");

    const avgTime = perResponseTimes.length
      ? Math.round(
          (perResponseTimes.reduce((s, v) => s + v, 0) /
            perResponseTimes.length) *
            10
        ) / 10
      : 0;

    const answersByQuestion = new Map();
    for (const r of responses) {
      for (const a of r.response_answers || []) {
        if (!answersByQuestion.has(a.questionId))
          answersByQuestion.set(a.questionId, []);
        answersByQuestion.get(a.questionId).push(a);
      }
    }

    const npsCandidates = [];
    const isNpsCategory = (q) => {
      const t = q.category?.type_name?.toLowerCase?.() || "";
      return t.includes("nps") || t.includes("net promoter");
    };

    const seems0to10 = (q) => {
      const qt = q.category?.type_name?.toLowerCase?.() || "";
      const ratingLike = qt === "rating" || qt === "linear scale";
      const has0to10Option = (q.options || []).some((o) => {
        if (typeof o.text === "string") {
          const num = Number(o.text.trim());
          return !Number.isNaN(num) && num >= 0 && num <= 10;
        }
        return false;
      });
      return ratingLike && has0to10Option;
    };

    const questionResults = [];
    const npsScores = [];

    for (const q of survey.questions || []) {
      const rawType = q.category?.type_name || "text";
      const uiType = mapType(rawType);
      const qa = answersByQuestion.get(q.id) || [];
      const responsesCount = qa.length;

      if (uiType === "single_choice" || uiType === "multiple_choice") {
        const counts = new Map((q.options || []).map((o) => [o.id, 0]));
        for (const a of qa) {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          for (const id of ids)
            if (counts.has(id)) counts.set(id, counts.get(id) + 1);
        }
        const data = (q.options || []).map((o) => ({
          option: o.text ?? "",
          count: counts.get(o.id) || 0,
          percentage: pct1(counts.get(o.id) || 0, responsesCount),
        }));
        questionResults.push({
          question: q.question_text,
          type: rawType,
          responses: responsesCount,
          data,
        });
      } else if (uiType === "rating") {
        const valueCount = new Map();
        let sum = 0;
        let n = 0;
        for (const a of qa) {
          let v = null;
          if (a.scaleRatingValue != null) {
            v = Number(a.scaleRatingValue);
          } else {
            const av = tryParse(a.answer_value);
            if (typeof av === "number") v = av;
            else if (
              typeof av === "string" &&
              av.trim() !== "" &&
              !Number.isNaN(Number(av))
            )
              v = Number(av);
            else {
              let ids = tryParse(a.selected_option_ids);
              if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
              if (ids.length) {
                const opt = (q.options || []).find((o) => o.id === ids[0]);
                if (opt?.text && !Number.isNaN(Number(opt.text)))
                  v = Number(opt.text);
              }
            }
          }
          if (typeof v === "number" && !Number.isNaN(v)) {
            valueCount.set(String(v), (valueCount.get(String(v)) || 0) + 1);
            sum += v;
            n += 1;
          }
        }
        const data = Array.from(valueCount.entries())
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([rating, count]) => ({ rating, count }));
        const averageRating = n ? Math.round((sum / n) * 10) / 10 : 0;

        if (isNpsCategory(q) || seems0to10(q)) {
          const npsVals = [];
          for (const [k, c] of valueCount.entries()) {
            const num = Number(k);
            if (!Number.isNaN(num)) {
              for (let i = 0; i < c; i++) npsVals.push(num);
            }
          }
          npsCandidates.push(...npsVals);
        }

        const isNPS = rawType?.toLowerCase() === "nps";

        if (isNPS) {
          const total = responsesCount;
          let detractors = 0;
          let passives = 0;
          let promoters = 0;

          for (const [rating, count] of valueCount.entries()) {
            const r = Number(rating);
            if (r >= 0 && r <= 6) detractors += count;
            else if (r >= 7 && r <= 8) passives += count;
            else if (r >= 9 && r <= 10) promoters += count;
          }

          const detractorsPercent =
            total > 0 ? Math.round((detractors / total) * 100) : 0;
          const passivesPercent =
            total > 0 ? Math.round((passives / total) * 100) : 0;
          const promotersPercent =
            total > 0 ? Math.round((promoters / total) * 100) : 0;
          const npsScore =
            total > 0
              ? Math.round(((promoters - detractors) / total) * 100)
              : 0;

          npsScores.push(npsScore);

          const distributionData = data.map(({ rating, count }) => ({
            score: rating,
            count: count,
          }));

          questionResults.push({
            question: q.question_text,
            type: rawType,
            responses: responsesCount,
            averageRating,
            npsScore,
            data: {
              detractors: detractorsPercent,
              passives: passivesPercent,
              promoters: promotersPercent,
            },
            distributionData,
          });
        } else {
          questionResults.push({
            question: q.question_text,
            type: rawType,
            responses: responsesCount,
            averageRating,
            data,
          });
        }
      } else if (uiType === "grid") {
        const cellCounts = new Map();
        for (const a of qa) {
          for (const g of a.grid_answers || []) {
            if (g.selected) {
              const key = `${g.rowOptionId}__${g.columnOptionId}`;
              cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
            }
          }
        }
        const data = (q.rowOptions || []).map((row) => ({
          row: row.text ?? "",
          cells: (q.columnOptions || []).map((col) => {
            const count = cellCounts.get(`${row.id}__${col.id}`) || 0;
            return {
              column: col.text ?? "",
              count,
              percentage: pct1(count, responsesCount),
            };
          }),
        }));
        questionResults.push({
          question: q.question_text,
          type: rawType,
          responses: responsesCount,
          data,
        });
      } else {
        const isNumber = rawType?.toLowerCase() === "number";

        if (isNumber) {
          const numbers = qa
            .map((a) => {
              const val = tryParse(a.answer_value);
              const num = Number(val);
              return !Number.isNaN(num) ? num : null;
            })
            .filter((v) => v !== null);

          if (numbers.length > 0) {
            const sum = numbers.reduce((acc, n) => acc + n, 0);
            const average = Math.round((sum / numbers.length) * 100) / 100;
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            const min = sortedNumbers[0];
            const max = sortedNumbers[sortedNumbers.length - 1];
            const median =
              sortedNumbers.length % 2 === 0
                ? (sortedNumbers[sortedNumbers.length / 2 - 1] +
                    sortedNumbers[sortedNumbers.length / 2]) /
                  2
                : sortedNumbers[Math.floor(sortedNumbers.length / 2)];

            questionResults.push({
              question: q.question_text,
              type: rawType,
              responses: qa.length,
              average,
              data: {
                min,
                max,
                median,
              },
            });
          } else {
            questionResults.push({
              question: q.question_text,
              type: rawType,
              responses: qa.length,
              average: null,
              data: {
                min: null,
                max: null,
                median: null,
              },
            });
          }
        } else {
          let sampleResponses = [];
          if (uiType === "text") {
            const texts = qa
              .map((a) => {
                const val = tryParse(a.answer_value);
                if (typeof val === "string") return val;
                if (val != null) return String(val);
                return null;
              })
              .filter((v) => typeof v === "string" && v.trim() !== "");
            const sorted = qa
              .map((a) => ({ t: a.submitted_at, v: tryParse(a.answer_value) }))
              .filter((x) => typeof x.v === "string" && x.v.trim() !== "")
              .sort((x, y) => new Date(y.t) - new Date(x.t))
              .slice(0, 5)
              .map((x) => x.v);
            sampleResponses = sorted.length ? sorted : texts.slice(0, 5);
          }

          questionResults.push({
            question: q.question_text,
            type: rawType,
            responses: qa.length,
            ...(uiType === "text" ? { sampleResponses } : {}),
          });
        }
      }
    }

    const overallNpsScore =
      npsScores.length > 0
        ? Math.round(
            npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length
          )
        : 0;

    const ratingMaxByQuestion = new Map();
    for (const q of survey.questions || []) {
      const qt = mapType(q.category?.type_name);
      if (qt === "rating") {
        const numericOptions = (q.options || [])
          .map((o) => Number(o.text))
          .filter((n) => !Number.isNaN(n));
        const rangeTos = (q.options || [])
          .map((o) => o.rangeTo)
          .filter((n) => typeof n === "number");
        const maxOpt = numericOptions.length
          ? Math.max(...numericOptions)
          : null;
        const maxRange = rangeTos.length ? Math.max(...rangeTos) : null;
        ratingMaxByQuestion.set(q.id, maxOpt ?? maxRange ?? 5);
      }
    }

    const individualResponses = responses.map((r) => {
      const times = (r.response_answers || []).map(
        (a) => a.submitted_at || r.created_at
      );
      const earliest = times.length
        ? times.reduce(
            (min, t) => (new Date(t) < new Date(min) ? t : min),
            times[0]
          )
        : r.created_at;
      const latest = times.length
        ? times.reduce(
            (max, t) => (new Date(t) > new Date(max) ? t : max),
            times[0]
          )
        : r.created_at;
      const completionTime = minutesBetween(earliest, latest);

      const answers = (r.response_answers || []).map((a) => {
        const q = a.question;
        const uiType = mapType(q?.category?.type_name);
        let answer = "";

        if (uiType === "single_choice" || uiType === "multiple_choice") {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          const labels = ids
            .map((id) => (q?.options || []).find((o) => o.id === id)?.text ?? "")
            .filter(Boolean);
          answer =
            uiType === "single_choice" ? (labels[0] ?? "") : labels.join(", ");
        } else if (uiType === "rating") {
          let v =
            a.scaleRatingValue != null ? Number(a.scaleRatingValue) : null;
          if (v == null) {
            const av = tryParse(a.answer_value);
            if (typeof av === "number") v = av;
            else if (
              typeof av === "string" &&
              av.trim() !== "" &&
              !Number.isNaN(Number(av))
            )
              v = Number(av);
            else {
              let ids = tryParse(a.selected_option_ids);
              if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
              if (ids.length) {
                const opt = (q?.options || []).find((o) => o.id === ids[0]);
                if (opt?.text && !Number.isNaN(Number(opt.text)))
                  v = Number(opt.text);
              }
            }
          }
          answer = v != null ? `${v}` : "";
        } else if (uiType === "grid") {
          const parts = [];
          for (const g of a.grid_answers || []) {
            if (!g.selected) continue;
            const row =
              (q?.rowOptions || []).find((o) => o.id === g.rowOptionId)?.text ?? "";
            const col =
              (q?.columnOptions || []).find((o) => o.id === g.columnOptionId)?.text ?? "";
            if (row || col) parts.push(`${row}: ${col}`);
          }
          answer = parts.join("; ");
        } else if (
          uiType === "text" ||
          uiType === "date" ||
          uiType === "time"
        ) {
          const val = tryParse(a.answer_value);
          answer =
            typeof val === "string" ? val : val != null ? String(val) : "";
        } else if (uiType === "file") {
          answer = a.mediaId ? `file:${a.mediaId}` : "";
        } else {
          const val = tryParse(a.answer_value);
          answer =
            typeof val === "string" ? val : val != null ? String(val) : "";
        }

        return { question: q?.question_text || "", answer };
      });

      return {
        id: r.id,
        submittedAt: new Date(latest)
          .toISOString()
          .slice(0, 16)
          .replace("T", " "),
        completionTime,
        answers,
      };
    });

    const byDay = new Map();
    for (const r of responses) {
      const label = fmtDayLabel(r.created_at);
      byDay.set(label, (byDay.get(label) || 0) + 1);
    }
    const responseTimeline = Array.from(byDay.entries())
      .sort((a, b) => {
        const [aMon, aDay] = a[0].split(" ");
        const [bMon, bDay] = b[0].split(" ");
        const aD = new Date(`${aMon} ${aDay}, ${new Date().getFullYear()}`);
        const bD = new Date(`${bMon} ${bDay}, ${new Date().getFullYear()}`);
        return aD - bD;
      })
      .map(([date, count]) => ({ date, responses: count }));

    const payload = {
      title: survey.title,
      description: survey.description || "",
      stats: {
        totalResponses,
        completionRate,
        avgTime,
        npsScore: overallNpsScore,
      },
      questionResults,
      individualResponses,
      responseTimeline,
    };

    return res.json(payload);
  } catch (err) {
    console.error("getSurveyAnalytics error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
