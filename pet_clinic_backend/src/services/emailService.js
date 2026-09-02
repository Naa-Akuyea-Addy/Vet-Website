const nodemailer = require("nodemailer");

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // Gmail's SMTP service is free for a clinic mailbox. Use an App Password,
  // never the account's normal password.
  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
    });
  }

  throw new Error("Email is not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD, or SMTP settings.");
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error("Recipient email is required");
  const transport = createTransport();
  return transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendEmail };
