const userModel = require("../models/userModel");
const {
  comparePassword,
  createToken,
  hashPassword,
} = require("../services/authService");

async function login(req, res) {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user || !(await comparePassword(password, user.PASSWORD_HASH)))
    return res.status(401).json({ message: "Invalid email or password" });
  res.json({
    token: createToken({
      id: user.USER_ID,
      email: user.EMAIL,
      role: user.ROLE,
    }),
    user: { id: user.USER_ID, email: user.EMAIL, name: user.FULL_NAME },
  });
}

async function register(req, res) {
  const { email, password, name, license_number, phone } = req.body;
  await userModel.create({
    email,
    passwordHash: await hashPassword(password),
    fullName: name,
    licenseNumber: license_number,
    phone,
  });
  res.status(201).json({ message: "User registered successfully" });
}

module.exports = { login, register };
