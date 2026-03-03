import prisma from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";

/**
 * @desc Register a new user
 */
export const register = async (req, res) => {
  try {
    const { name, email, mobile_no, password, role, theme } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        mobile_no,
        password: hashedPassword,
        role: role || "USER",
        theme: theme || "LIGHT",
      },
    });

    const token = generateToken(user);
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Login user
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res
        .status(400)
        .json({ message: "No account registered with the provided email." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    if (user.is_blocked)
      return res
        .status(400)
        .json({ message: "Your account is Blocked by Admin." });

    const token = generateToken(user);
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN Route handlers

// To get All Users List
export const getAllUsers = async (req, res) => {
  try {
    const query = req.query;
    // Parse page & limit with defaults
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    const skip = (page - 1) * limit;

    console.log("Page:", page, "Limit:", limit);

    // Get total users count
    const total = await prisma.user.count();
    console.log(">>>> the value of TOTAL is : ", total);

    const allUsers = await prisma.user.findMany({
      skip: skip,
      take: limit,
      orderBy: {
        created_at: "desc", // optional but recommended
      },
    });
    console.log(">>>>> the value of the ALL USERS is : ", allUsers);

    const totalPages = Math.ceil(total / limit);
    console.log(">>>> the value of the totalPages is : ", totalPages);

    return res.status(200).json({
      message: "Users get successfully.",
      data: allUsers,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    console.log(">>>> the error in the GET all users api is : ", error);
    return res.status(500).send({ message: "Server error", error });
  }
};

// For creating the User
export const createUser = async (req, res) => {
  try {
    const body = req.body;
    console.log(">>>> the value of the BODY is : ", body);
    const { name, email, mobile_no, password, role, theme } = body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "User already exists" });
    const existingMobile = await prisma.user.findUnique({
      where: { mobile_no },
    });
    if (existingMobile) {
      return res.status(400).json({ message: "Mobile no already used" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        mobile_no,
        password: hashedPassword,
        role: role || "USER",
        theme: theme || "LIGHT",
      },
    });
    console.log(">>>> the value of the USER created is : ", user);

    return res
      .status(200)
      .json({ message: "User created successfully.", data: user });
  } catch (error) {
    cosnole.log(">>>>> the error in the CREATE USER function is : ", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

// For updating User
export const updateUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(">>>>> the value of the USER ID is : ", userId);

    const body = req.body;
    console.log(">>>>> the value of the BODY is : ", body);

    const { name, mobile_no, role, theme } = body;

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    console.log(">>>> the value of the EXISTING is : ", existing);
    if (!existing)
      return res.status(404).json({ message: "User does not exist." });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, mobile_no, role, theme },
    });
    console.log(">>>>> the value of the UPDATED user is : ", updatedUser);

    return res
      .status(200)
      .json({ message: "User updated successfully.", data: updatedUser });
  } catch (error) {
    console.log(">>>> the error in the UPDATE user function is : ", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

export const toggleUserBlocked = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(">>>>> the value of the USER ID is : ", userId);

    const { is_blocked } = req.body;
    console.log(">>>>> the value of the IS_BLOCKED is : ", is_blocked);

    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing)
      return res.status(404).json({ message: "User does not exist." });
    console.log(">>>>> the value of the EXISTING is : ", existing);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { is_blocked },
    });
    console.log(">>>>. the value of the UDPATED USER is : ", updatedUser);

    return res.status(200).json({
      message: `User ${is_blocked == true ? "Blocked" : "Un-blocked"} successfully.`,
      data: updatedUser,
    });
  } catch (error) {
    console.log(
      ">>>> the error in the toggleUserBlocked function is : ",
      error,
    );
    return res.status(500).json({ message: "Server error", error });
  }
};
