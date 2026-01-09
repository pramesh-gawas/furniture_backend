const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enums: ["user", "admin"],
    default: "user",
  },
});

userSchema.pre("save", async function (next) {
  const person = this;

  if (!person.isModified("password")) return;
  //hash the password only if it has been modified (or is new)

  try {
    //hash password generate

    const salt = await bcrypt.genSalt(10);
    // hash password
    const hashedPassword = await bcrypt.hash(person.password, salt);

    //override the plain password with the hashed one
    person.password = hashedPassword;
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    throw error;
  }
};

userSchema.index(
  { role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: "admin" },
  }
);

const User = mongoose.model("user", userSchema);
module.exports = User;
