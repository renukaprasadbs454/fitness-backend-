const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../config/logger");

/**
 * Sends email via SMTP (Nodemailer). Transporter is created lazily and
 * cached — env vars are read once, not on every send.
 *
 * Best-effort: never throws. If SMTP isn't configured or the send fails,
 * it logs a warning and returns { sent: false } so callers (e.g. the OTP
 * flow) can keep working via the existing dev-mode console log instead of
 * breaking registration/password-reset over an email provider hiccup.
 */
let transporter;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.email.smtpHost,
    port: env.email.smtpPort,
    secure: env.email.smtpPort === 465,
    auth: {
      user: env.email.smtpUser,
      pass: env.email.smtpPass
    }
  });

  return transporter;
}

async function sendEmail({ to, subject, html }) {
  if (!env.email.smtpHost || !env.email.smtpUser || !env.email.smtpPass) {
    logger.warn("[email] SMTP not configured — skipping real email send.");
    return { sent: false };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.email.fromAddress,
      to,
      subject,
      html
    });

    logger.info(`[email] Sent "${subject}" to ${to} (id: ${info.messageId})`);
    return { sent: true, id: info.messageId };
  } catch (err) {
    logger.warn(`[email] Send threw: ${err.message}`);
    return { sent: false };
  }
}

module.exports = { sendEmail };
