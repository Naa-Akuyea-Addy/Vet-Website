const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
//const { GoogleGenerativeAI } = require("@google/generative-ai");
//const OpenAI = require("openai");
const { Groq } = require("groq-sdk");
const { errorHandler } = require("./src/middleware/errorHandler");
const authRoutes = require("./src/routes/authRoutes");
const appointmentRoutes = require("./src/routes/appointmentRoutes");
const billingRoutes = require("./src/routes/billingRoutes");
const inventoryRoutes = require("./src/routes/inventoryRoutes");
const patientRoutes = require("./src/routes/patientRoutes");
const staffRoutes = require("./src/routes/staffRoutes");
const emergencyRoutes = require("./src/routes/emergencyRoutes");
const reportRoutes = require("./src/routes/reportRoutes");
const settingsRoutes = require("./src/routes/settingsRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const authController = require("./src/controllers/authController");
const { checkConnection } = require("./src/config/database");

const publicDirectory = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : path.join(__dirname, "..", "public");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Add this line to your server.js
app.use("/node_modules", express.static("node_modules"));

app.use(cors());
// Profile photos are sent as small base64 payloads; Express defaults to 100 KB.
app.use(express.json({ limit: "4mb" }));

// Modular API used by the admin panel. Legacy public endpoints remain below.
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/health", async (req, res, next) => {
  try {
    await checkConnection();
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    error.status = 503;
    next(error);
  }
});

// serve frontend files
app.use(express.static(publicDirectory));
app.use(
  "/admin_portal_vet_website",
  express.static(path.join(__dirname, "admin_portal_vet_website")),
);

app.get("/admin_portal_vet_website/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "admin_portal_vet_website", "Dashboard.html"),
  );
});

// Add this line - serve home as the default landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDirectory, "home.html"));
});

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT,
};

app.post("/book-appointment", async (req, res) => {
  const {
    pet_name,
    pet_species,
    pet_age,
    owner_name,
    owner_phone,
    visit_reason,
    service,
    appointment_time,
  } = req.body;

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    await connection.execute(
      `INSERT INTO appointments
            (pet_name, pet_species, pet_age, owner_name, owner_phone, visit_reason, service, appointment_time)
            VALUES (:pet_name, :pet_species, :pet_age, :owner_name, :owner_phone, :visit_reason, :service,
              :appointment_time)`,

      {
        pet_name,
        pet_species,
        pet_age,
        owner_name,
        owner_phone,
        visit_reason,
        service,
        appointment_time,
      },

      { autoCommit: true },
    );

    res.json({
      success: true,
      message: "Appointment booked successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

// Login route (uses authController with roles and permissions)
app.post("/login", authController.login);
app.post("/forgot-password", authController.requestPasswordReset);
app.post("/reset-password", authController.resetPassword);

// app.post("/register", async (req, res) => {
//   let connection;

//   try {
//     const { email, password, name, license_number, phone } = req.body;

//     if (
//       !email ||
//       !password ||
//       !name ||
//       !license_number ||
//       !phone ||
//       typeof password !== "string"
//     ) {
//       return res
//         .status(400)
//         .json({ message: "All registration fields are required" });
//     }

//     connection = await oracledb.getConnection(dbConfig);

//     const hashedPassword = await bcrypt.hash(password, 10);

//     await connection.execute(
//       `INSERT INTO USERS (EMAIL, PASSWORD_HASH,FULL_NAME, LICENSE_NUMBER, PHONE)
//              VALUES (:email, :password_hash, :full_name, :license_number, :phone)`,
//       {
//         email,
//         password_hash: hashedPassword,
//         full_name: name,
//         license_number,
//         phone,
//       },
//       { autoCommit: true },
//     );

//     res.json({ message: "User registered successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   } finally {
//     if (connection) await connection.close();
//   }
// });

// API endpoint for contact form
app.post("/contact-form", async (req, res) => {
  const { name, pet_breed, email, customer_questions } = req.body;
  const ip_address = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    // For CLOB (large text) handling
    const sql = `
            INSERT INTO contact_form (name, pet_breed, email, customer_questions, ip_address)
            VALUES (:name, :pet_breed, :email, :customer_questions, :ip_address)
            RETURNING id INTO :id
        `;

    const result = await connection.execute(
      sql,
      {
        name,
        pet_breed,
        email,
        customer_questions,
        ip_address,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );

    res.json({
      success: true,
      message: "",
      id: result.outBinds.id[0],
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Failed to save message" });
  } finally {
    if (connection) await connection.close();
  }
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.post("/api/triage", async (req, res) => {
  try {
    const { symptoms, age, animal, duration } = req.body;

    const prompt = `You are a veterinary triage assistant. Analyze the following pet symptoms and return ONLY a valid JSON object with no markdown formatting or extra text. 
    The JSON must have exactly these three keys:
    1. "isValid": boolean (false if the input is gibberish, irrelevant, or lacks describable symptoms)
    2. "triageLevel": string (must be exactly "CRITICAL", "URGENT", or "STANDARD")
    3. "reasoning": string (a brief, 1-2 sentence explanation of the triage level based on standard veterinary guidelines)

    Input Data:
    - Symptoms: "${symptoms}"
    - Age: "${age}"
    - Animal: "${animal}"
    - Duration: "${duration}"`;

    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile", // Free, incredibly fast model
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    res.json(result);
  } catch (error) {
    console.error("Groq Triage Error:", error);
    res
      .status(500)
      .json({ error: "Failed to analyze symptoms. Please try again." });
  }
});

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
