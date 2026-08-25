async function sendEmail({ to, subject, text }) {
  if (!to) throw new Error("Recipient email is required");
  console.log(`Email queued for ${to}: ${subject}`);
  return { to, subject, text, queued: true };
}

module.exports = { sendEmail };
