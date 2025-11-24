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
