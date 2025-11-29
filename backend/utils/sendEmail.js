/**
 * sendEmail(options)
 * options: { to, subject, text, html }
 * If SMTP env vars are set (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * the function will attempt to send email via nodemailer. Otherwise it
 * will log the message and return the content (useful for dev).
 */
module.exports = async function sendEmail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log("sendEmail (dev):", { to, subject, text, html });
    return { ok: true, dev: true, to, subject, text, html };
  }

  // Lazy-require nodemailer only when SMTP is configured, so dev setups
  // without the package installed won't crash the app.
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (e) {
    // If nodemailer isn't installed, surface a helpful error rather than
    // letting the require crash the process. Caller can fallback to dev.
    console.error(
      "sendEmail: nodemailer not installed but SMTP is configured.",
      e.message
    );
    throw new Error(
      "nodemailer not installed; run 'npm install nodemailer' in backend/"
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return { ok: true, info };
};
