const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { jwtAuthMiddleWare, generateToken } = require("../jwt");
require("dotenv").config();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const UserProfile = new User({
      email,
      password,
      role,
    });

    if (role === "admin") {
      const existingAdmin = await User.findOne({ role: "admin" });
      if (existingAdmin) {
        console.log("An admin user already exists. Cannot create another.");
        return res.status(409).json({
          error: "An admin user already exists. Only one admin is allowed.",
        });
      }
    }
    const newUser = new User(UserProfile);
    const response = await newUser.save();
    console.log("data saved");

    const payload = {
      id: response.id,
      email: response.email,
      role: response.role,
    };
    const token = generateToken(payload);
    res.status(200).json({
      response: response,
      token: token,
      message: "User Registered Successfully",
    });
  } catch (error) {
    console.log(error);
    if (error.name === "ValidationError") {
      const errors = Object.keys(error.errors).map(
        (key) => error.errors[key].message
      );
      return res.status(400).json({ message: "Validation failed", errors });
    } else if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];

      let errorMessage = `The ${field} '${value}' already exists. Please use a different one.`;

      if (field === "email") {
        errorMessage =
          "This email is already registered. Please login instead.";
      }

      return res.status(409).json({
        message: `Duplicate Entry ${errorMessage}`,
        field: field,
      });
    } else {
      return res
        .status(500)
        .json({ error: "Internal Server Error", message: error.message });
    }
  }
});
//login route

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email.password);
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email });
    console.log(user);

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "invalid email or password" });
    }
    const payload = {
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
    };

    const token = generateToken(payload);

    res.json({ token, message: "You have successfully logged in!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal server Error" });
  }
});

router.get("/profile", jwtAuthMiddleWare, async (req, res) => {
  try {
    const userData = req.user;
    const userId = userData.response._id;
    const user = await User.findById(userId).select("-password");
    console.log(user);
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;
