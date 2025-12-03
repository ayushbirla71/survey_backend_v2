import prisma from "../config/db.js";
import { markTokenUsed } from "./shareController.js";

/**
 * ✅ Helper: Normalize and prepare answers based on question type
 */
const prepareAnswerData = async (answers) => {
  const preparedAnswers = [];

  for (const a of answers) {
    const question = await prisma.question.findUnique({
      where: { id: a.questionId },
      include: { category: true },
    });

    if (!question) continue;

    const type = question.category?.type_name?.toLowerCase() || "text";

    let answerValue = null;
    let scaleRatingValue = null;
    let mediaLinks = [];
    let selectedOptionIds = null;
    let gridAnswers = [];

    switch (type) {
      // ✅ TEXT TYPES
      case "short answer":
      case "paragraph":
        answerValue = a.answer_value || "";
        break;

      // ✅ SINGLE OPTION TYPES
      case "multiple choice":
      case "dropdown":
        selectedOptionIds = Array.isArray(a.answer_value)
          ? [a.answer_value[0]]
          : [a.answer_value];
        break;

      // ✅ MULTIPLE OPTION TYPES
      case "checkboxes":
        selectedOptionIds = Array.isArray(a.answer_value)
          ? a.answer_value
          : [a.answer_value];
        break;

      // ✅ LINEAR SCALE / RATING
      case "linear scale":
      case "rating":
        // You can store either numeric rating or optionId.
        selectedOptionIds = a.optionId || null;
        if (!selectedOptionIds)
          scaleRatingValue = Number(a.answer_value) || null;
        break;

      // ✅ GRID QUESTION TYPES
      case "multi-choice grid":
      case "checkbox grid":
        /**
         * Expect input like:
         * a.answer_value = [
         *   { rowOptionId: "row1", selectedColumns: ["col1", "col2"] },
         *   { rowOptionId: "row2", selectedColumns: ["col3"] }
         * ]
         */
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

      // ✅ FILE UPLOAD
      case "file upload":
        mediaLinks = a.media?.length ? a.media : [];
        break;

      // ✅ DATE / TIME
      case "date":
      case "time":
        answerValue = a.answer_value || null;
        break;

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
    });
  }

  return preparedAnswers;
};

/**
 * ✅ Main transaction for creating responses
 */
const createSurveyResponse = async (surveyId, user_metadata, answers) => {
  const formattedAnswers = await prepareAnswerData(answers);

  return await prisma.$transaction(async (tx) => {
    const response = await tx.response.create({
      data: {
        surveyId,
        user_metadata: user_metadata || {},
      },
    });

    for (const ans of formattedAnswers) {
      const resAnswer = await tx.responseAnswer.create({
        data: {
          responseId: response.id,
          questionId: ans.questionId,
          // answer_type: ans.answer_type,
          answer_value: JSON.stringify(ans.answer_value),
          // media: ans.media,
          selected_option_ids: ans.selected_option_ids,
          scaleRatingValue: ans.scaleRatingValue,
        },
      });

      // ✅ Handle grid data
      if (ans.gridAnswers?.length > 0) {
        await tx.gridResponseAnswer.createMany({
          data: ans.gridAnswers.map((g) => ({
            responseAnswerId: resAnswer.id,
            rowOptionId: g.rowOptionId,
            columnOptionId: g.columnOptionId,
            selected: g.selected,
          })),
        });
      }
    }

    // ✅ Return response with all nested data
    return tx.response.findUnique({
      where: { id: response.id },
      include: {
        response_answers: {
          include: {
            grid_answers: true,
            question: true,
          },
        },
      },
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

    const shareToken = await prisma.shareToken.findFirst({
      where: { token_hash: token },
      include: { survey: true },
    });
    if (!shareToken) return res.status(400).json({ message: "Invalid Token." });
    if (shareToken.used)
      return res.status(400).json({ message: "Token already used." });

    res.status(201).json({ message: "Response submitted" });

    const response = await createSurveyResponse(
      shareToken.surveyId,
      user_metadata,
      answers
    );

    if (
      shareToken.recipient_email ||
      shareToken.recipient_mobile ||
      shareToken.agentUserUniqueId
    )
      await markTokenUsed(token);
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
    const responses = await prisma.response.findMany({
      where: { surveyId },
      include: {
        response_answers: {
          include: {
            grid_answers: true,
            question: true,
          },
        },
      },
    });
    res.json({ responses });
  } catch (error) {
    console.error("Get Responses Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add to responseController.js

export const getSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;

    // 1) Get survey questions with options + category/type
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          include: {
            options: true,
            rowOptions: true,
            columnOptions: true,
            category: true,
          },
        },
      },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const questionIds = survey.questions.map((q) => q.id);

    // 2) Get total responses for survey (respondent base)
    const totalResponses = await prisma.response.count({
      where: { surveyId },
    });

    // 3) Pull all answers for these questions, including grids
    const answers = await prisma.responseAnswer.findMany({
      where: { questionId: { in: questionIds } },
      include: { grid_answers: true },
    });

    // Group answers by questionId
    const byQuestion = new Map();
    for (const a of answers) {
      if (!byQuestion.has(a.questionId)) byQuestion.set(a.questionId, []);
      byQuestion.get(a.questionId).push(a);
    }

    // Helpers
    const pct = (num, den) =>
      den > 0 ? Math.round((num / den) * 10000) / 100 : 0;

    const results = [];

    for (const q of survey.questions) {
      const type = q.category?.type_name?.toLowerCase?.() || "text";

      const qAnswers = byQuestion.get(q.id) || [];
      const totalAnswers = qAnswers.length;
      const skipped = Math.max(totalResponses - totalAnswers, 0);
      const answerRate = pct(totalAnswers, totalResponses);

      // Build per-type breakdowns
      let breakdown = null;
      let rating = null;
      let grid = null;

      // Select-type questions: multiple choice, dropdown, checkboxes
      if (
        type === "multiple choice" ||
        type === "dropdown" ||
        type === "checkboxes"
      ) {
        const optionCount = new Map(q.options.map((o) => [o.id, 0]));

        for (const a of qAnswers) {
          let ids = a.selected_option_ids;
          // selected_option_ids is JSON in Prisma; ensure array
          if (typeof ids === "string") {
            try {
              ids = JSON.parse(ids);
            } catch {
              ids = null;
            }
          }
          if (!Array.isArray(ids)) continue;

          // For multiple choice/dropdown there should be 1; for checkboxes, many
          for (const id of ids) {
            if (optionCount.has(id)) {
              optionCount.set(id, optionCount.get(id) + 1);
            }
          }
        }

        breakdown = q.options.map((opt) => {
          const count = optionCount.get(opt.id) || 0;
          return {
            optionId: opt.id,
            label: opt.text ?? "",
            count,
            percent: pct(count, totalAnswers),
          };
        });
      }

      // Rating / linear scale
      else if (type === "linear scale" || type === "rating") {
        const valueCount = new Map();
        let sum = 0;
        let n = 0;

        // If your implementation stores optionId in selected_option_ids, this will count those as categories.
        // If you store numeric in scaleRatingValue, this will build numeric distribution and average.
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
            // Treat selected option id as a categorical "value"
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
      }

      // Grid questions: multi-choice grid / checkbox grid
      else if (type === "multi-choice grid" || type === "checkbox grid") {
        // Build a map for counts per row->col
        const rowColCount = new Map(); // key `${rowId}__${colId}` -> count

        for (const a of qAnswers) {
          for (const g of a.grid_answers || []) {
            if (g.selected) {
              const key = `${g.rowOptionId}__${g.columnOptionId}`;
              rowColCount.set(key, (rowColCount.get(key) || 0) + 1);
            }
          }
        }

        const rows = q.rowOptions.map((row) => {
          const columns = q.columnOptions.map((col) => {
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

      // Text / file / date / time: return answer rate only
      results.push({
        questionId: q.id,
        question_text: q.question_text,
        type,
        totalAnswers,
        skipped,
        answerRate, // percent of respondents who answered this question
        breakdown, // for select types
        rating, // for rating/linear scale
        grid, // for grid types
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

// Helper: safe JSON parse (for selected_option_ids, answer_value, etc.)
const tryParse = (v) => {
  if (v == null) return null;
  if (Array.isArray(v) || typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

// Helper: percentage with 1 decimal (e.g., 7.5)
const pct1 = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

// Helper: map category type_name to UI type keys
const mapType = (type) => {
  const t = (type || "").toLowerCase();
  if (t === "multiple choice" || t === "dropdown") return "single_choice";
  if (t === "checkboxes") return "multiple_choice";
  if (t === "linear scale" || t === "rating") return "rating";
  if (t === "multi-choice grid" || t === "checkbox grid") return "grid";
  if (t === "short answer" || t === "paragraph") return "text";
  if (t === "date") return "date";
  if (t === "time") return "time";
  if (t === "file upload") return "file";
  return "text";
};

// Helper: format date label like "Jun 15"
const fmtDayLabel = (d) => {
  const dt = new Date(d);
  const month = dt.toLocaleString("en-US", { month: "short" });
  const day = dt.getDate();
  return `${month} ${day.toString().padStart(2, "0")}`;
};

// Helper: minutes between two dates (float, 1 decimal)
const minutesBetween = (start, end) => {
  const ms = new Date(end) - new Date(start);
  return Math.round((ms / 60000) * 10) / 10;
};

// Compute NPS from numeric ratings (0-10)
const computeNPS = (vals) => {
  const nums = vals.filter((v) => typeof v === "number" && v >= 0 && v <= 10);
  const n = nums.length;
  if (!n) return 0;
  const detractors = nums.filter((v) => v >= 0 && v <= 6).length;
  const promoters = nums.filter((v) => v >= 9 && v <= 10).length;
  const nps = (promoters / n - detractors / n) * 100;
  return Math.round(nps);
};

export const getSurveyAnalytics = async (req, res) => {
  try {
    const { surveyId } = req.params;

    // Survey + questions + option metadata
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { order_index: "asc" },
          include: {
            options: true,
            rowOptions: true,
            columnOptions: true,
            category: true,
          },
        },
        share_tokens: true,
      },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // Pull all responses with answers and nested grid cells
    const responses = await prisma.response.findMany({
      where: { surveyId },
      orderBy: { created_at: "asc" },
      include: {
        response_answers: {
          include: {
            grid_answers: true,
            question: {
              include: {
                options: true,
                rowOptions: true,
                columnOptions: true,
                category: true,
              },
            },
          },
        },
      },
    });

    const totalResponses = responses.length;

    // Completion rate: % of responses that answered all required questions
    const requiredQIds = survey.questions
      .filter((q) => q.required)
      .map((q) => q.id);
    const isComplete = (resp) => {
      if (!requiredQIds.length) return true;
      const answered = new Set(resp.response_answers.map((a) => a.questionId));
      return requiredQIds.every((id) => answered.has(id));
    };
    const completedCount = responses.filter(isComplete).length;
    const shareTokensCount = survey.share_tokens.length;
    const completionRate =
      survey.survey_send_by === "NONE"
        ? 100
        : pct1(completedCount, shareTokensCount);

    // Average completion time (minutes) using per-response min/max submitted_at
    const perResponseTimes = responses
      .map((r) => {
        const times = r.response_answers.map(
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

    // Build question-wise aggregates
    const answersByQuestion = new Map();
    for (const r of responses) {
      for (const a of r.response_answers) {
        if (!answersByQuestion.has(a.questionId))
          answersByQuestion.set(a.questionId, []);
        answersByQuestion.get(a.questionId).push(a);
      }
    }

    // Detect NPS question and collect candidate values
    const npsCandidates = [];
    const isNpsCategory = (q) => {
      const t = q.category?.type_name?.toLowerCase?.() || "";
      return t.includes("nps") || t.includes("net promoter");
    };
    const seems0to10 = (q) => {
      // if options contain a range marker or numbers 0..10 in text, or this is rating/linear-scale
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
    for (const q of survey.questions) {
      const rawType = q.category?.type_name || "text";
      const uiType = mapType(rawType);
      const qa = answersByQuestion.get(q.id) || [];
      const responsesCount = qa.length;

      // Choice distributions
      if (uiType === "single_choice" || uiType === "multiple_choice") {
        const counts = new Map(q.options.map((o) => [o.id, 0]));
        for (const a of qa) {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          for (const id of ids)
            if (counts.has(id)) counts.set(id, counts.get(id) + 1);
        }
        const data = q.options.map((o) => ({
          option: o.text ?? "",
          count: counts.get(o.id) || 0,
          percentage: pct1(counts.get(o.id) || 0, responsesCount),
        }));
        questionResults.push({
          question: q.question_text,
          type: uiType,
          responses: responsesCount,
          data,
        });
      }

      // Rating distribution + average
      else if (uiType === "rating") {
        const valueCount = new Map();
        let sum = 0;
        let n = 0;
        // Try numeric from scaleRatingValue, else parse from answer_value or from selected option text
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
                const opt = q.options.find((o) => o.id === ids[0]);
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

        // If this looks like NPS, collect for global NPS
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

        questionResults.push({
          question: q.question_text,
          type: "rating",
          responses: responsesCount,
          averageRating,
          data,
        });
      }

      // Grid questions
      else if (uiType === "grid") {
        // Count per row/col
        const cellCounts = new Map(); // key rowId__colId
        for (const a of qa) {
          for (const g of a.grid_answers || []) {
            if (g.selected) {
              const key = `${g.rowOptionId}__${g.columnOptionId}`;
              cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
            }
          }
        }
        const data = q.rowOptions.map((row) => ({
          row: row.text ?? "",
          cells: q.columnOptions.map((col) => {
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
          type: "grid",
          responses: responsesCount,
          data,
        });
      }

      // Text/date/time/file: provide counts and samples for text
      else {
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
          // take up to 4 recent samples (by submitted_at desc)
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
          type: uiType,
          responses: qa.length,
          ...(uiType === "text" ? { sampleResponses } : {}),
        });
      }
    }

    // Global NPS score
    const npsScore = computeNPS(npsCandidates);

    // Individual Responses section
    // Attempt to infer rating max for display like "4/5"
    const ratingMaxByQuestion = new Map();
    for (const q of survey.questions) {
      const qt = mapType(q.category?.type_name);
      if (qt === "rating") {
        // Prefer max numeric option text or option.rangeTo; default 5
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
      // completion time as earlier
      const times = r.response_answers.map(
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

      // answers rendered as strings
      const answers = r.response_answers.map((a) => {
        const q = a.question;
        const uiType = mapType(q.category?.type_name);
        let answer = "";

        if (uiType === "single_choice" || uiType === "multiple_choice") {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          const labels = ids
            .map((id) => q.options.find((o) => o.id === id)?.text ?? "")
            .filter(Boolean);
          answer =
            uiType === "single_choice" ? labels[0] ?? "" : labels.join(", ");
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
                const opt = q.options.find((o) => o.id === ids[0]);
                if (opt?.text && !Number.isNaN(Number(opt.text)))
                  v = Number(opt.text);
              }
            }
          }
          const maxV = ratingMaxByQuestion.get(q.id) ?? 5;
          answer = v != null ? `${v}/${maxV}` : "";
        } else if (uiType === "grid") {
          const parts = [];
          for (const g of a.grid_answers || []) {
            if (!g.selected) continue;
            const row =
              q.rowOptions.find((o) => o.id === g.rowOptionId)?.text ?? "";
            const col =
              q.columnOptions.find((o) => o.id === g.columnOptionId)?.text ??
              "";
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
          // If storing mediaId, could fetch MediaAsset; here we expose mediaId
          answer = a.mediaId ? `file:${a.mediaId}` : "";
        } else {
          const val = tryParse(a.answer_value);
          answer =
            typeof val === "string" ? val : val != null ? String(val) : "";
        }

        return { question: q.question_text, answer };
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

    // Timeline: group responses per day label
    const byDay = new Map();
    for (const r of responses) {
      const label = fmtDayLabel(r.created_at);
      byDay.set(label, (byDay.get(label) || 0) + 1);
    }
    const responseTimeline = Array.from(byDay.entries())
      .sort((a, b) => {
        // sort by date by reconstructing a Date from label
        const [aMon, aDay] = a[0].split(" ");
        const [bMon, bDay] = b[0].split(" ");
        const aD = new Date(`${aMon} ${aDay}, ${new Date().getFullYear()}`);
        const bD = new Date(`${bMon} ${bDay}, ${new Date().getFullYear()}`);
        return aD - bD;
      })
      .map(([date, count]) => ({ date, responses: count }));

    // Final payload
    const payload = {
      title: survey.title,
      description: survey.description || "",
      stats: {
        totalResponses,
        completionRate, // %
        avgTime, // minutes
        npsScore, // -100..100
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

    // Survey + questions + option metadata
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { order_index: "asc" },
          include: {
            options: true,
            rowOptions: true,
            columnOptions: true,
            category: true,
          },
        },
      },
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // Pull all responses with answers and nested grid cells
    const responses = await prisma.response.findMany({
      where: { surveyId },
      orderBy: { created_at: "asc" },
      include: {
        response_answers: {
          include: {
            grid_answers: true,
            question: {
              include: {
                options: true,
                rowOptions: true,
                columnOptions: true,
                category: true,
              },
            },
          },
        },
      },
    });

    const totalResponses = responses.length;

    // Completion rate: % of responses that answered all required questions
    const requiredQIds = survey.questions
      .filter((q) => q.required)
      .map((q) => q.id);
    const isComplete = (resp) => {
      if (!requiredQIds.length) return true;
      const answered = new Set(resp.response_answers.map((a) => a.questionId));
      return requiredQIds.every((id) => answered.has(id));
    };
    const completedCount = responses.filter(isComplete).length;
    const completionRate = Math.round(pct1(completedCount, totalResponses));

    // Average completion time (minutes) using per-response min/max submitted_at
    const perResponseTimes = responses
      .map((r) => {
        const times = r.response_answers.map(
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

    // Build question-wise aggregates
    const answersByQuestion = new Map();
    for (const r of responses) {
      for (const a of r.response_answers) {
        if (!answersByQuestion.has(a.questionId))
          answersByQuestion.set(a.questionId, []);
        answersByQuestion.get(a.questionId).push(a);
      }
    }

    // Detect NPS question and collect candidate values
    const npsCandidates = [];
    const isNpsCategory = (q) => {
      const t = q.category?.type_name?.toLowerCase?.() || "";
      return t.includes("nps") || t.includes("net promoter");
    };
    const seems0to10 = (q) => {
      // if options contain a range marker or numbers 0..10 in text, or this is rating/linear-scale
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
    for (const q of survey.questions) {
      const rawType = q.category?.type_name || "text";
      const uiType = mapType(rawType);
      const qa = answersByQuestion.get(q.id) || [];
      const responsesCount = qa.length;

      // Choice distributions
      if (uiType === "single_choice" || uiType === "multiple_choice") {
        const counts = new Map(q.options.map((o) => [o.id, 0]));
        for (const a of qa) {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          for (const id of ids)
            if (counts.has(id)) counts.set(id, counts.get(id) + 1);
        }
        const data = q.options.map((o) => ({
          option: o.text ?? "",
          count: counts.get(o.id) || 0,
          percentage: pct1(counts.get(o.id) || 0, responsesCount),
        }));
        questionResults.push({
          question: q.question_text,
          type: uiType,
          responses: responsesCount,
          data,
        });
      }

      // Rating distribution + average
      else if (uiType === "rating") {
        const valueCount = new Map();
        let sum = 0;
        let n = 0;
        // Try numeric from scaleRatingValue, else parse from answer_value or from selected option text
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
                const opt = q.options.find((o) => o.id === ids[0]);
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

        // If this looks like NPS, collect for global NPS
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

        questionResults.push({
          question: q.question_text,
          type: "rating",
          responses: responsesCount,
          averageRating,
          data,
        });
      }

      // Grid questions
      else if (uiType === "grid") {
        // Count per row/col
        const cellCounts = new Map(); // key rowId__colId
        for (const a of qa) {
          for (const g of a.grid_answers || []) {
            if (g.selected) {
              const key = `${g.rowOptionId}__${g.columnOptionId}`;
              cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
            }
          }
        }
        const data = q.rowOptions.map((row) => ({
          row: row.text ?? "",
          cells: q.columnOptions.map((col) => {
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
          type: "grid",
          responses: responsesCount,
          data,
        });
      }

      // Text/date/time/file: provide counts and samples for text
      else {
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
          // take up to 4 recent samples (by submitted_at desc)
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
          type: uiType,
          responses: qa.length,
          ...(uiType === "text" ? { sampleResponses } : {}),
        });
      }
    }

    // Global NPS score
    const npsScore = computeNPS(npsCandidates);

    // Individual Responses section
    // Attempt to infer rating max for display like "4/5"
    const ratingMaxByQuestion = new Map();
    for (const q of survey.questions) {
      const qt = mapType(q.category?.type_name);
      if (qt === "rating") {
        // Prefer max numeric option text or option.rangeTo; default 5
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
      // completion time as earlier
      const times = r.response_answers.map(
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

      // answers rendered as strings
      const answers = r.response_answers.map((a) => {
        const q = a.question;
        const uiType = mapType(q.category?.type_name);
        let answer = "";

        if (uiType === "single_choice" || uiType === "multiple_choice") {
          let ids = tryParse(a.selected_option_ids);
          if (!Array.isArray(ids)) ids = ids != null ? [ids] : [];
          const labels = ids
            .map((id) => q.options.find((o) => o.id === id)?.text ?? "")
            .filter(Boolean);
          answer =
            uiType === "single_choice" ? labels[0] ?? "" : labels.join(", ");
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
                const opt = q.options.find((o) => o.id === ids[0]);
                if (opt?.text && !Number.isNaN(Number(opt.text)))
                  v = Number(opt.text);
              }
            }
          }
          const maxV = ratingMaxByQuestion.get(q.id) ?? 5;
          answer = v != null ? `${v}` : "";
          // answer = v != null ? `${v}/${maxV}` : "";
        } else if (uiType === "grid") {
          const parts = [];
          for (const g of a.grid_answers || []) {
            if (!g.selected) continue;
            const row =
              q.rowOptions.find((o) => o.id === g.rowOptionId)?.text ?? "";
            const col =
              q.columnOptions.find((o) => o.id === g.columnOptionId)?.text ??
              "";
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
          // If storing mediaId, could fetch MediaAsset; here we expose mediaId
          answer = a.mediaId ? `file:${a.mediaId}` : "";
        } else {
          const val = tryParse(a.answer_value);
          answer =
            typeof val === "string" ? val : val != null ? String(val) : "";
        }

        return { question: q.question_text, answer };
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

    // Timeline: group responses per day label
    const byDay = new Map();
    for (const r of responses) {
      const label = fmtDayLabel(r.created_at);
      byDay.set(label, (byDay.get(label) || 0) + 1);
    }
    const responseTimeline = Array.from(byDay.entries())
      .sort((a, b) => {
        // sort by date by reconstructing a Date from label
        const [aMon, aDay] = a[0].split(" ");
        const [bMon, bDay] = b[0].split(" ");
        const aD = new Date(`${aMon} ${aDay}, ${new Date().getFullYear()}`);
        const bD = new Date(`${bMon} ${bDay}, ${new Date().getFullYear()}`);
        return aD - bD;
      })
      .map(([date, count]) => ({ date, responses: count }));

    // Final payload
    const payload = {
      title: survey.title,
      description: survey.description || "",
      stats: {
        totalResponses,
        completionRate, // %
        avgTime, // minutes
        npsScore, // -100..100
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

// import prisma from "../config/db.js";
// import { markTokenUsed } from "./shareController.js";

// /**
//  * Submit Response
//  */
// export const submitResponse = async (req, res) => {
//   try {
//     const { surveyId, user_metadata, answers } = req.body;

//     // Create Response
//     const response = await prisma.response.create({
//       data: {
//         surveyId,
//         user_metadata: user_metadata || {},
//         response_answers: {
//           create: answers.map((a) => ({
//             questionId: a.questionId,
//             answer_type: a.answer_type,
//             answer_value: a.answer_value,
//             media: a.media || [],
//           })),
//         },
//       },
//       include: { response_answers: true },
//     });

//     res.status(201).json({ message: "Response submitted", response });
//   } catch (error) {
//     console.error("Submit Response Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * Submit Response with a share token
//  */
// export const submitResponseWithToken = async (req, res) => {
//   try {
//     const { token, user_metadata, answers } = req.body;

//     // Validate share token
//     const shareToken = await prisma.shareToken.findFirst({
//       where: { token_hash: token, used: false },
//       include: { survey: true },
//     });

//     if (!shareToken)
//       return res.status(400).json({ message: "Invalid or used token" });

//     const surveyId = shareToken.surveyId;

//     // Create response
//     const response = await prisma.response.create({
//       data: {
//         surveyId,
//         user_metadata: user_metadata || {},
//         response_answers: {
//           create: answers.map((a) => ({
//             questionId: a.questionId,
//             answer_type: a.answer_type,
//             answer_value: a.answer_value,
//             media: a.media || [],
//           })),
//         },
//       },
//       include: { response_answers: true },
//     });

//     // Mark token as used (if personalized)
//     if (shareToken.recipient_email || shareToken.recipient_mobile) {
//       await markTokenUsed(token);
//     }

//     res.status(201).json({ message: "Response submitted", response });
//   } catch (error) {
//     console.error("Submit Response With Token Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * Get responses for a survey
//  */
// export const getResponsesBySurvey = async (req, res) => {
//   try {
//     const { surveyId } = req.params;

//     const responses = await prisma.response.findMany({
//       where: { surveyId },
//       include: { response_answers: true },
//     });

//     res.json({ responses });
//   } catch (error) {
//     console.error("Get Responses Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };
