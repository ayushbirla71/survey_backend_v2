import { SurveyCategory, QuestionCategory } from "../models/index.js";

export const createSurveyCategory = async (req, res) => {
  try {
    const { array, name } = req.body;
    if (array) {
      const createSurveyCategories = await Promise.all(
        array.map((arr) =>
          SurveyCategory.create({ name: arr })
        )
      );
      console.log(
        ">>>>> the value of create Survey Categories is : ",
        createSurveyCategories
      );
      return res.status(200).json({
        message: "Added successfully.",
        categories: createSurveyCategories,
      });
    } else {
      const category = await SurveyCategory.create({ name });

      return res
        .status(201)
        .json({ message: "Category created", categories: category });
    }
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all categories for survey
 */
export const getSurveyCategories = async (req, res) => {
  try {
    const categories = await SurveyCategory.findAll();

    res.json({ categories });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createQuestionCategory = async (req, res) => {
  try {
    const { type_name } = req.body;
    console.log(">>>> the value of the TYPE_NAME is : ", type_name);

    const createQuestionCategory = await QuestionCategory.create({ type_name });
    console.log(
      ">>>>> the value of the CREATE QUESTION CATEGORY is : ",
      createQuestionCategory
    );

    return res
      .status(200)
      .json({ message: "Created successfully", data: createQuestionCategory });
  } catch (error) {
    console.log(
      ">>>> the error in the Create Question Category function is : ",
      error
    );
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all categories for survey
 */
export const getQuestionCategories = async (req, res) => {
  try {
    const categories = await QuestionCategory.findAll();

    res.json({ categories });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};