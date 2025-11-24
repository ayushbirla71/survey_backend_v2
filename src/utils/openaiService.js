import OpenAI from "openai";

// Lazy initialization of OpenAI client
let openai = null;

const getOpenAIClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

/**
 * Generate survey questions using OpenAI
 * @param {Object} surveyData - Survey information
 * @param {string} surveyData.title - Survey title
 * @param {string} surveyData.description - Survey description
 * @param {string} surveyData.categoryOfSurvey - Survey category
 * @param {number} questionCount - Number of questions to generate (default: 5)
 * @returns {Promise<Array>} Array of generated questions
 */
export const generateSurveyQuestions = async (
  surveyData,
  questionCount = 5
) => {
  try {
    const { title, description, categoryOfSurvey } = surveyData;

    // Create a detailed prompt for question generation
    const prompt = `
You are an expert survey designer. Generate ${questionCount} high-quality survey questions based on the following information:

Survey Title: ${title}
Survey Description: ${description || "No description provided"}
Survey Category: ${categoryOfSurvey || "General"}

Requirements:
1. Generate exactly ${questionCount} questions
2. Include a mix of question types: TEXT, MCQ, RATING
3. For MCQ questions, provide 3-5 relevant options
4. For RATING questions, use a 1-5 scale
5. Make questions clear, unbiased, and relevant to the survey topic
6. Ensure questions flow logically and cover different aspects of the topic

Return the response as a JSON array with the following structure for each question:
{
  "question_type": "TEXT|MCQ|RATING",
  "question_text": "The actual question text",
  "options": ["option1", "option2", "option3"] // Only for MCQ, empty array for others
}

Example for MCQ:
{
  "question_type": "MCQ",
  "question_text": "What is your primary reason for using our service?",
  "options": ["Cost-effective", "Easy to use", "Good customer support", "Recommended by others"]
}

Example for TEXT:
{
  "question_type": "TEXT",
  "question_text": "Please describe your overall experience with our service.",
  "options": []
}

Example for RATING:
{
  "question_type": "RATING",
  "question_text": "How would you rate the quality of our customer service? (1 = Very Poor, 5 = Excellent)",
  "options": []
}

Generate the questions now:`;

    // Get OpenAI client (lazy initialization)
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a professional survey designer who creates high-quality, unbiased survey questions. Always respond with valid JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content.trim();

    // Try to parse the JSON response
    let questions;
    try {
      // Remove any markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?|\n?```/g, "")
        .trim();
      questions = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      console.error("Raw response:", responseText);
      throw new Error("Failed to parse AI response. Please try again.");
    }

    // Validate the response structure
    if (!Array.isArray(questions)) {
      throw new Error("AI response is not an array of questions");
    }

    // Validate each question and add metadata
    const validatedQuestions = questions.map((question, index) => {
      if (!question.question_type || !question.question_text) {
        throw new Error(`Invalid question structure at index ${index}`);
      }

      // Ensure valid question types
      const validTypes = ["TEXT", "MCQ", "RATING"];
      if (!validTypes.includes(question.question_type)) {
        question.question_type = "TEXT"; // Default fallback
      }

      // Ensure options is an array
      if (!Array.isArray(question.options)) {
        question.options = [];
      }

      // Add metadata
      return {
        ...question,
        order_index: index + 1,
        required: true,
        ai_prompt: prompt,
        ai_model: "gpt-3.5-turbo",
        confidence_score: 0.8, // Default confidence score
      };
    });

    return validatedQuestions;
  } catch (error) {
    console.error("OpenAI API Error:", error);

    // Return fallback questions if OpenAI fails
    if (
      error.code === "insufficient_quota" ||
      error.code === "rate_limit_exceeded"
    ) {
      throw new Error(
        "AI service temporarily unavailable. Please try again later."
      );
    }

    throw new Error(`Failed to generate questions: ${error.message}`);
  }
};

/**
 * Generate fallback questions when OpenAI is not available
 * @param {Object} surveyData - Survey information
 * @param {number} questionCount - Number of questions to generate
 * @returns {Array} Array of fallback questions
 */
export const generateFallbackQuestions = (surveyData, questionCount = 5) => {
  const { title, categoryOfSurvey } = surveyData;

  const fallbackQuestions = [
    {
      question_type: "RATING",
      question_text: `How would you rate your overall experience with ${title}? (1 = Very Poor, 5 = Excellent)`,
      options: [],
      order_index: 1,
      required: true,
    },
    {
      question_type: "MCQ",
      question_text: "How did you hear about us?",
      options: [
        "Social Media",
        "Search Engine",
        "Word of Mouth",
        "Advertisement",
        "Other",
      ],
      order_index: 2,
      required: true,
    },
    {
      question_type: "TEXT",
      question_text: "What improvements would you suggest?",
      options: [],
      order_index: 3,
      required: false,
    },
    {
      question_type: "MCQ",
      question_text: "How likely are you to recommend us to others?",
      options: [
        "Very Likely",
        "Likely",
        "Neutral",
        "Unlikely",
        "Very Unlikely",
      ],
      order_index: 4,
      required: true,
    },
    {
      question_type: "TEXT",
      question_text: "Any additional comments or feedback?",
      options: [],
      order_index: 5,
      required: false,
    },
  ];

  return fallbackQuestions.slice(0, questionCount).map((question, index) => ({
    ...question,
    order_index: index + 1,
    ai_prompt: "Fallback questions generated due to AI service unavailability",
    ai_model: "fallback",
    confidence_score: 0.5,
  }));
};

/**
 * Generates a survey JSON object using the Gemini API.
 * @param {string} title - The title of the survey.
 * @param {string} category - The category of the survey.
 * @param {string} description - A brief description of the survey.
 * @returns {Promise<object | null>} - The generated survey JSON object, or null on error.
 */
// export const generateSurveyQuestionsWithCategory = async (
//   title,
//   category,
//   description
// ) => {
//   try {
//     console.log(">>>>>> the value of the CATEGORY is : ", category);
//     // --- Main Function to Generate Survey ---

//     // 1. The Question Type Map (from your Untitled-2.json)
//     const questionTypeMap = {
//       date: "276364c5-1b96-4b4e-a362-833973532241",
//       paragraph: "4234edbe-bb13-4acd-918b-ea83e3107eb4",
//       dropdown: "516210a8-16c5-465c-aa84-7a02b3c032a4",
//       "file upload": "56abdae6-9b0d-4313-9187-8330ae8121e5",
//       "checkbox grid": "60516591-f744-4efd-ae56-58d8e1ca911c",
//       checkboxes: "86e2d9dc-2f36-47ff-b502-cc24532091d9",
//       "linear scale": "97140e9a-acf8-4293-93b6-022a6962bce1",
//       "multiple choice": "ad17eee6-d97e-4bdc-9870-2881ea2b391f",
//       rating: "b0a418b1-f832-4b02-a44a-683008e6761b",
//       time: "d16778d4-85bc-4fac-8815-2bb2f1346fd9",
//       "multi-choice grid": "d6c6b58e-0037-4295-a9ec-4a1b6ff03429",
//       "short answer": "e690972c-0956-442e-a0b4-3c109c3d42f7",
//     };

//     // 2. The JSON Schema (Based on your survey_token_JSON_response.JSON)
//     const surveyResponseSchema = {
//       type: "OBJECT",
//       properties: {
//         survey: {
//           type: "OBJECT",
//           properties: {
//             title: { type: "STRING" },
//             description: { type: "STRING" },
//             no_of_questions: { type: "INTEGER" },
//             questions: {
//               type: "ARRAY",
//               items: {
//                 type: "OBJECT",
//                 properties: {
//                   question_type: { type: "STRING", enum: ["TEXT"] },
//                   question_text: { type: "STRING" },
//                   order_index: { type: "INTEGER" },
//                   required: { type: "BOOLEAN" },
//                   categoryId: { type: "STRING" },
//                   options: {
//                     type: "ARRAY",
//                     items: {
//                       type: "OBJECT",
//                       properties: {
//                         text: { type: "STRING", nullable: true },
//                         rowQuestionOptionId: { type: "STRING", nullable: true },
//                         columnQuestionOptionId: {
//                           type: "STRING",
//                           nullable: true,
//                         },
//                         rangeFrom: { type: "INTEGER", nullable: true },
//                         rangeTo: { type: "INTEGER", nullable: true },
//                         fromLabel: { type: "STRING", nullable: true },
//                         toLabel: { type: "STRING", nullable: true },
//                       },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     };

//     // 3. The System Instruction (Prompt Engineering)
//     const systemPrompt = `
//     You are an expert survey generation assistant. Your task is to generate a complete survey in JSON format with high-quality, relevant questions.
//     You will be given a title, category, and description for a survey.

//     RULES:
//     1.  Generate an appropriate number of questions (e.g., 5-10) based on the survey's description.
//     2.  The 'title' and 'description' in the JSON output MUST exactly match the user's input.
//     3.  For each question, you MUST select the most appropriate question type (e.g., "multiple choice", "linear scale", "short answer") from the user's provided map.
//     4.  The generated questions MUST be high-quality, clear, and directly relevant to the survey's topic.
//     5.  The survey as a whole MUST use a minimum of 3 different question types to ensure variety.
//     6.  You MUST use the "Question Type Map" provided by the user to find the correct 'categoryId' for the question type you select.
//     7.  You MUST generate relevant 'options' for each question type:
//         - For "linear scale" or "rating", set 'rangeFrom', 'rangeTo', and optionally 'fromLabel'/'toLabel'.
//         - For "multiple choice", "checkboxes", or "dropdown", add several relevant text options.
//         - For "short answer" or "paragraph", the 'options' array MUST be empty.
//     8.  The final output MUST be a single JSON object matching the provided schema.
//   `;

//     // 4. The User Content (The actual data)
//     const userQuery = `
//     Please generate a survey with the following details:
//     - Title: "${title}"
//     - Category: "${category}"
//     - Description: "${description}"

//     Here is the Question Type Map you MUST use for all 'categoryId' fields:
//     ${JSON.stringify(questionTypeMap, null, 2)}
//   `;

//     // 5. Construct the API Payload
//     const payload = {
//       systemInstruction: {
//         parts: [{ text: systemPrompt }],
//       },
//       contents: [
//         {
//           parts: [{ text: userQuery }],
//         },
//       ],
//       generationConfig: {
//         responseMimeType: "application/json",
//         responseSchema: surveyResponseSchema,
//       },
//     };

//     // 6. Make the API Call
//     // NOTE: The API key is left as "" here.
//     // In a real Node.js environment, you would get this from process.env.API_KEY
//     // For this tool's environment, "" is correct.
//     const apiKey = "AIzaSyBssUT0dLWN3FpcovQLmcsarcL_DwKa_jY"; // Leave empty, Canvas will handle it
//     const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

//     // console.log("Calling Gemini API...");

//     try {
//       const response = await fetch(apiUrl, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (!response.ok) {
//         const errorBody = await response.text();
//         throw new Error(
//           `API call failed with status: ${response.status}\nBody: ${errorBody}`
//         );
//       }

//       const result = await response.json();

//       if (
//         result.candidates &&
//         result.candidates.length > 0 &&
//         result.candidates[0].content &&
//         result.candidates[0].content.parts
//       ) {
//         const jsonText = result.candidates[0].content.parts[0].text;
//         // The API guarantees this text is valid JSON matching your schema
//         const surveyData = JSON.parse(jsonText);

//         // Update the question count based on what the AI generated
//         if (surveyData.survey && surveyData.survey.questions) {
//           surveyData.survey.no_of_questions =
//             surveyData.survey.questions.length;
//         }

//         return surveyData?.survey?.questions;
//       } else {
//         // Handle cases where the response might be blocked or empty
//         console.error(
//           "API response was missing expected content:",
//           JSON.stringify(result, null, 2)
//         );
//         throw new Error("No valid response content from API.");
//       }
//     } catch (error) {
//       console.error("Error generating survey:", error.message);
//       return null;
//     }
//   } catch (err) {
//     console.log(
//       ">>>> the error in the generateSurveyQuestionsWithCategory function is : ",
//       err
//     );
//     return null;
//   }
// };

export const generateSurveyQuestionsWithCategory = async (
  title,
  category,
  description
) => {
  console.log(
    ">>>>> the value of the TITLE is : ",
    title,
    " and Description is : ",
    description
  );
  try {
    console.log(">>>>>> the value of the CATEGORY is : ", category);
    // --- Main Function to Generate Survey ---

    // 1. The Question Type Map (from your Untitled-2.json)
    const questionTypeMap = {
      date: "276364c5-1b96-4b4e-a362-833973532241",
      paragraph: "4234edbe-bb13-4acd-918b-ea83e3107eb4",
      dropdown: "516210a8-16c5-465c-aa84-7a02b3c032a4",
      "file upload": "56abdae6-9b0d-4313-9187-8330ae8121e5",
      "checkbox grid": "60516591-f744-4efd-ae56-58d8e1ca911c",
      checkboxes: "86e2d9dc-2f36-47ff-b502-cc24532091d9",
      "linear scale": "97140e9a-acf8-4293-93b6-022a6962bce1",
      "multiple choice": "ad17eee6-d97e-4bdc-9870-2881ea2b391f",
      rating: "b0a418b1-f832-4b02-a44a-683008e6761b",
      time: "d16778d4-85bc-4fac-8815-2bb2f1346fd9",
      "multi-choice grid": "d6c6b58e-0037-4295-a9ec-4a1b6ff03429",
      "short answer": "e690972c-0956-442e-a0b4-3c109c3d42f7",
    };

    // 2. The JSON Schema (Based on your survey_token_JSON_response.JSON)
    // 🚨 START OF CHANGE: Updated surveyResponseSchema for grid options
    const optionSchema = {
      type: "OBJECT",
      properties: {
        text: { type: "STRING", nullable: true },
        rowQuestionOptionId: { type: "STRING", nullable: true },
        columnQuestionOptionId: { type: "STRING", nullable: true },
        rangeFrom: { type: "INTEGER", nullable: true },
        rangeTo: { type: "INTEGER", nullable: true },
        fromLabel: { type: "STRING", nullable: true },
        toLabel: { type: "STRING", nullable: true },
      },
    };

    const surveyResponseSchema = {
      type: "OBJECT",
      properties: {
        survey: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            no_of_questions: { type: "INTEGER" },
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  question_type: { type: "STRING", enum: ["TEXT"] },
                  question_text: { type: "STRING" },
                  order_index: { type: "INTEGER" },
                  required: { type: "BOOLEAN" },
                  categoryId: { type: "STRING" },
                  // Standard options array for non-grid types
                  options: {
                    type: "ARRAY",
                    items: optionSchema,
                    nullable: true, // Make nullable for grid types
                  },
                  // Row options array for grid types (multi-choice grid, checkbox grid)
                  rowOptions: {
                    type: "ARRAY",
                    items: optionSchema,
                    nullable: true,
                  },
                  // Column options array for grid types (multi-choice grid, checkbox grid)
                  columnOptions: {
                    type: "ARRAY",
                    items: optionSchema,
                    nullable: true,
                  },
                },
              },
            },
          },
        },
      },
    };
    // 🚨 END OF CHANGE: Updated surveyResponseSchema for grid options

    // 3. The System Instruction (Prompt Engineering)
    // 🚨 START OF CHANGE: Updated System Prompt Rule 7
    const systemPrompt = `
		You are an expert survey generation assistant. Your task is to generate a complete survey in JSON format with high-quality, relevant questions.
		You will be given a title, category, and description for a survey.

		RULES:
    0.  The JSON MUST NOT exceed 2000 characters in total.
		1.  Generate an appropriate number of questions (e.g., 5-7) based on the survey's description must be 5 to 7.
		2.  The 'title' and 'description' in the JSON output MUST exactly match the user's input.
		3.  For each question, you MUST select the most appropriate question type (e.g., "multiple choice", "linear scale", "short answer") from the user's provided map.
		4.  The generated questions MUST be high-quality, clear, and directly relevant to the survey's topic.
		5.  The survey as a whole MUST use a minimum of 3 different question types to ensure variety.
		6.  You MUST use the "Question Type Map" provided by the user to find the correct 'categoryId' for the question type you select.
		7.  You MUST generate relevant options based on the question type:
			- For "multi-choice grid" and "checkbox grid", you MUST use the 'rowOptions' array for the row labels (e.g., specific statements/items) and the 'columnOptions' array for the column labels (e.g., scale points like "Strongly Disagree" to "Strongly Agree"). The 'options' array MUST be empty . 1) Maximum 4 rowOptions 2) Maximum 4 columnOptions.
			- For "linear scale" or "rating", use the 'options' array, setting 'rangeFrom', 'rangeTo', and optionally 'fromLabel'/'toLabel'. The 'rowOptions' and 'columnOptions' arrays MUST be empty.
			- For "multiple choice", "checkboxes", or "dropdown", use the 'options' array, adding several relevant text options. The 'rowOptions' and 'columnOptions' arrays MUST be empty.
			- For "short answer" or "paragraph", all three option arrays ('options', 'rowOptions', 'columnOptions') MUST be empty.
		8.  The final output MUST be a single JSON object matching the provided schema.
    9.  Title must NOT exceed 100 characters. Question text <= 120 characters.
    10. NEVER repeat characters or patterns like "18_18_18_18…"
    11. NEVER include filler text or extend text unnecessarily.
	`;

    // 4. The User Content (The actual data)
    const userQuery = `
		Please generate a survey with the following details:
		- Title: "${title}"
		- Category: "${category}"
		- Description: "${description}"

		Here is the Question Type Map you MUST use for all 'categoryId' fields:
		${JSON.stringify(questionTypeMap, null, 2)}
	`;

    // 5. Construct the API Payload
    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: userQuery }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: surveyResponseSchema,
      },
    };

    // 6. Make the API Call
    const apiKey = "AIzaSyBssUT0dLWN3FpcovQLmcsarcL_DwKa_jY";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `API call failed with status: ${response.status}\nBody: ${errorBody}`
        );
      }

      const result = await response.json();
      console.log(
        ">>>>> the value of the RESULT is : ",
        JSON.stringify(result)
      );

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts
      ) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const surveyData = JSON.parse(jsonText);

        // Update the question count based on what the AI generated
        if (surveyData.survey && surveyData.survey.questions) {
          surveyData.survey.no_of_questions =
            surveyData.survey.questions.length;
        }

        return surveyData?.survey?.questions;
      } else {
        console.error(
          "API response was missing expected content:",
          JSON.stringify(result, null, 2)
        );
        throw new Error("No valid response content from API.");
      }
    } catch (error) {
      console.error("Error generating survey:", error.message);
      return null;
    }
  } catch (err) {
    console.log(
      ">>>> the error in the generateSurveyQuestionsWithCategory function is : ",
      err
    );
    return null;
  }
};
