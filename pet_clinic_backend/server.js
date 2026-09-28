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
const vetRoutes = require("./src/routes/vetRoutes");
const doctorAvailabilityRoutes = require("./src/routes/doctorAvailabilityRoutes");
const recurringBlockRoutes = require("./src/routes/recurringBlockRoutes");
const staffMessageRoutes = require("./src/routes/staffMessageRoutes");
const payrollRoutes = require("./src/routes/payrollRoutes");
const authController = require("./src/controllers/authController");
const { checkConnection } = require("./src/config/database");
const { startRetentionSchedule } = require("./src/services/retentionService");
const emergencyModel = require("./src/models/emergencyModel");

const publicDirectory = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : path.join(__dirname, "..", "public");

const app = express();
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// Add this line to your server.js
app.use("/node_modules", express.static("node_modules"));

app.use(cors());
// Profile photos & medical documents (x-rays, PDFs) sent as base64 payloads
app.use(express.json({ limit: "15mb" }));

// Modular API used by the admin panel. Legacy public endpoints remain below.
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/vets", vetRoutes);
app.use("/api/doctor-availability", doctorAvailabilityRoutes);
app.use("/api/recurring-blocks", recurringBlockRoutes);
app.use("/api/staff-messages", staffMessageRoutes);

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
    veterinarian_id
  } = req.body;

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    // Assignment is made on the server so a client cannot choose or spoof a
    // veterinarian. The least-busy active vet is selected from STAFF and
    // matched to its portal account in USERS.
    const vetResult = await connection.execute(
      `SELECT USER_ID
       FROM (
         SELECT u.USER_ID, COUNT(a.APPOINTMENT_ID) AS ACTIVE_APPOINTMENTS
         FROM STAFF s
         JOIN USERS u ON s.USER_ID = u.USER_ID
         LEFT JOIN APPOINTMENTS a
           ON a.VETERINARIAN_ID = u.USER_ID
          AND a.STATUS IN ('Pending', 'Confirmed')
         WHERE LOWER(NVL(u.STATUS, 'Active')) = 'active'
           AND (LOWER(NVL(s.JOB_TITLE, '')) LIKE '%vet%'
             OR LOWER(NVL(s.JOB_TITLE, '')) LIKE '%surgeon%'
             OR LOWER(NVL(s.DEPARTMENT, '')) LIKE '%veterinary%'
             OR LOWER(NVL(s.DEPARTMENT, '')) LIKE '%clinical%')
         GROUP BY u.USER_ID
         ORDER BY ACTIVE_APPOINTMENTS ASC, u.USER_ID ASC
       ) WHERE ROWNUM = 1`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const assignedVeterinarianId = vetResult.rows?.[0]?.USER_ID || null;

    const trimmedPhone = (owner_phone || "").toString().trim();
    const cleanPhone = trimmedPhone.replace(/[^0-9]/g, "");

    let patientLookup = null;
    if (cleanPhone) {
      patientLookup = await connection.execute(
        `SELECT PATIENT_ID, OWNER_PHONE
         FROM PATIENTS
         WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
           AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name))
           AND NVL(REGEXP_REPLACE(OWNER_PHONE, '[^0-9]', ''), '') = :clean_phone
         ORDER BY PATIENT_ID DESC
         FETCH FIRST 1 ROWS ONLY`,
        {
          owner_name,
          clean_phone: cleanPhone,
          pet_name,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
    }

    if (!patientLookup?.rows?.[0]?.PATIENT_ID) {
      patientLookup = await connection.execute(
        `SELECT PATIENT_ID, OWNER_PHONE
         FROM PATIENTS
         WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
           AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name))
         ORDER BY PATIENT_ID DESC
         FETCH FIRST 1 ROWS ONLY`,
        {
          owner_name,
          pet_name,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
    }

    let patient_id = patientLookup?.rows?.[0]?.PATIENT_ID || null;
    if (patient_id) {
      const currentPhone = (patientLookup.rows[0].OWNER_PHONE || "").toString().trim();
      if (!currentPhone && trimmedPhone) {
        await connection.execute(
          `UPDATE PATIENTS SET OWNER_PHONE = :owner_phone WHERE PATIENT_ID = :id`,
          { owner_phone: trimmedPhone, id: patient_id },
        );
      }
    } else {
      const patientResult = await connection.execute(
        `INSERT INTO patients (owner_name, owner_phone, pet_name, pet_species, pet_age)
         VALUES (:owner_name, :owner_phone, :pet_name, :pet_species, :pet_age)
         RETURNING patient_id INTO :patient_id`,
        {
          owner_name,
          owner_phone: trimmedPhone,
          pet_name,
          pet_species,
          pet_age,
          patient_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: false },
      );
      patient_id = patientResult.outBinds.patient_id?.[0] || null;
    }

    // Insert the appointment linked to the existing or newly created patient.
    const appointmentSql = `
      INSERT INTO appointments (patient_id, pet_name, pet_species, pet_age, owner_name, owner_phone, visit_reason, service, appointment_time, veterinarian_id)
      VALUES (:patient_id, :pet_name, :pet_species, :pet_age, :owner_name, :owner_phone, :visit_reason, :service, :appointment_time, :veterinarian_id)
      RETURNING appointment_id INTO :appointment_id
    `;

    const appointmentResult = await connection.execute(
      appointmentSql,
      {
        patient_id,
        pet_name,
        pet_species,
        pet_age,
        owner_name,
        owner_phone,
        visit_reason,
        service,
        appointment_time,
        veterinarian_id: assignedVeterinarianId,
        appointment_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );

    const appointment_id = appointmentResult.outBinds.appointment_id
      ? appointmentResult.outBinds.appointment_id[0]
      : null;

    // Check if appointment falls under emergency cases
    const reasonText = (visit_reason || "").toLowerCase();
    const serviceText = (service || "").toLowerCase();
    const emergencyKeywords = [
      "bleed", "blood", "seizure", "chok", "unconscious", "breathing",
      "hit by car", "hit by a car", "poison", "toxic", "swallow", "ate a",
      "paraly", "severe pain", "screaming", "crying in pain", "vomiting blood",
      "bloody", "heatstroke", "burn", "broken bone", "trauma", "attack",
      "bite wound", "not waking up", "limping badly", "collapse", "bloat",
      "swollen stomach", "straining to pee", "euthanasia", "dying", "emergency"
    ];

    const isEmergencyReason = emergencyKeywords.some(kw => reasonText.includes(kw));
    const isEmergencyService = serviceText.includes("emergency") || serviceText.includes("urgent");

    let emergencyCaseId = null;
    if (isEmergencyReason || isEmergencyService) {
      try {
        const isCritical = reasonText.includes("unconscious") ||
                           reasonText.includes("collapse") ||
                           reasonText.includes("blue gums") ||
                           reasonText.includes("seizure") ||
                           reasonText.includes("hit by") ||
                           reasonText.includes("chok") ||
                           reasonText.includes("poison") ||
                           reasonText.includes("not waking up");
        const priority = isCritical ? "CRITICAL" : "URGENT";

        const tags = [];
        if (isCritical || reasonText.includes("dehydrat") || reasonText.includes("bleed") || reasonText.includes("collapse")) {
          tags.push("iv");
        }
        if (reasonText.includes("cough") || reasonText.includes("parvo") || reasonText.includes("vomit") || reasonText.includes("infect")) {
          tags.push("contagious");
        }
        if (reasonText.includes("bite") || reasonText.includes("growl")) {
          tags.push("bite");
        }
        if (reasonText.includes("aggress") || reasonText.includes("attack")) {
          tags.push("aggressive");
        }

        emergencyCaseId = await emergencyModel.create({
          patient_id: patient_id,
          patient_name: pet_name,
          species: pet_species || "Dog",
          age: pet_age || "Adult",
          owner_name: owner_name,
          owner_phone: trimmedPhone || owner_phone,
          description: `Appointment Booking [${service || "Visit"}]: ${visit_reason}`,
          priority: priority,
          source: "booking",
          ai_reasoning: `Emergency intake flagged during appointment booking (${priority} priority). Chief complaint: "${visit_reason}"`,
          tags: tags,
        });
      } catch (emErr) {
        console.error("Failed to auto-create emergency case from booking:", emErr);
      }
    }

    res.json({
      success: true,
      message: "Appointment booked successfully",
      appointment_id,
      patient_id,
      emergency_case_id: emergencyCaseId,
      veterinarian_id: assignedVeterinarianId,
      message: assignedVeterinarianId
        ? "Appointment booked and veterinarian assigned"
        : "Appointment booked, but no eligible veterinarian is available",
    });
  } catch (err) {
    console.error(err);

    // If there was a DB error, attempt to rollback any partial work
    try {
      if (connection) await connection.rollback();
    } catch (e) {
      console.error('Rollback failed', e);
    }

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
    const { symptoms, age, animal, duration, pet_name, owner_name, owner_phone } = req.body;

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

    let response;
    try {
      response = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
    } catch (modelErr) {
      console.warn("Primary model failed, trying fallback model:", modelErr.message);
      response = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "openai/gpt-oss-20b",
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
    }

    const result = JSON.parse(response.choices[0].message.content);

    // If valid emergency triage, persist directly into EMERGENCY_CASES database
    if (result && result.isValid) {
      try {
        const text = (symptoms || "").toLowerCase();
        const tags = [];
        if (result.triageLevel === "CRITICAL" || text.includes("dehydrat") || text.includes("bleed") || text.includes("collapse")) {
          tags.push("iv");
        }
        if (text.includes("cough") || text.includes("parvo") || text.includes("discharge") || text.includes("fever") || text.includes("infect") || text.includes("vomit")) {
          tags.push("contagious");
        }
        if (text.includes("bite") || text.includes("growl") || text.includes("snarl")) {
          tags.push("bite");
        }
        if (text.includes("aggress") || text.includes("attack")) {
          tags.push("aggressive");
        }

        const emergencyId = await emergencyModel.create({
          patient_name: pet_name || (animal ? `Guest ${animal}` : "Emergency Pet"),
          owner_name: owner_name || "Website Pet Parent",
          owner_phone: owner_phone || "",
          species: animal || "Dog",
          age: age || "Adult",
          description: `${symptoms} (Duration: ${duration || "Unknown"})`,
          priority: result.triageLevel,
          source: "website",
          ai_reasoning: result.reasoning,
          tags: tags,
        });

        result.emergencyId = emergencyId;
      } catch (dbErr) {
        console.error("Error saving emergency triage to DB:", dbErr);
      }
    }

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
  startRetentionSchedule();
});
