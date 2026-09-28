const model = require("../models/appointmentModel");
const { sendEmail } = require("../services/emailService");

async function list(req, res, next) {
  try {
    // Use enriched list that JOINs PATIENTS and BOOKINGS
    const rows = await model.listWithBookings();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    const id = req.params.id;
    const row = await model.findById(id);
    if (!row) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const result = await model.create(req.body);
    res.status(201).json({
      success: true,
      appointment_id: result.appointmentId,
      patient_id: result.patientId,
      veterinarian_id: result.veterinarianId,
      message: result.veterinarianId
        ? "Appointment created and veterinarian assigned"
        : "Appointment created, but no eligible veterinarian is available",
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await model.updateStatus(id, status);
    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    await model.update(id, req.body);
    res.json({ success: true, message: 'Appointment updated successfully' });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const result = await model.remove(id);
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    res.json({ success: true, message: "Appointment deleted successfully" });
  } catch (error) {
    next(error);
  }
}

// Send a reply email to a customer who submitted a contact form enquiry
async function sendEnquiryReply(req, res, next) {
  try {
    const { to, name, subject, replyMessage } = req.body;
    if (!to || !replyMessage) {
      return res.status(400).json({ success: false, message: "Recipient email and message are required." });
    }
    const emailSubject = subject || `Re: Your enquiry at addyPets Veterinary Clinic`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px;">
        <div style="background:#036469;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
          <h2 style="color:#fff;margin:0;">🐾 addyPets Veterinary Clinic</h2>
        </div>
        <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;">
          <p style="color:#1b1c1c;">Dear ${name || 'Valued Customer'},</p>
          <p style="color:#1b1c1c;line-height:1.7;">${replyMessage.replace(/\n/g, '<br>')}</p>
          <hr style="border:none;border-top:1px solid #e4e2e1;margin:24px 0;">
          <p style="color:#6f797a;font-size:13px;">This is an official reply from addyPets Veterinary Clinic. If you have further questions, please contact us directly.</p>
        </div>
      </div>`;
    await sendEmail({ to, subject: emailSubject, html, text: replyMessage });
    res.json({ success: true, message: `Reply sent to ${to} successfully.` });
  } catch (error) {
    console.error("Enquiry reply email error:", error.message);
    next(error);
  }
}

module.exports = { list, get, create, update, updateStatus, remove, sendEnquiryReply };
