const env = require("../config/env");
const logger = require("../config/logger");

/**
 * Sends an email via Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
 * Uses the platform's built-in fetch (Node >=18, per package.json engines) —
 * no SDK dependency needed for a single POST call.
 *
 * Best-effort: never throws. If RESEND_API_KEY isn't configured or the send
 * fails, it logs a warning and returns { sent: false } so callers (e.g. the
 * OTP flow) can keep working via the existing dev-mode console log instead
 * of breaking registration/password-reset over an email provider hiccup.
 */
async function sendEmail({ to, subject, html }) {
  if (!env.email.resendApiKey) {
    logger.warn("[email] RESEND_API_KEY not set — skipping real email send.");
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: env.email.fromAddress, to, subject, html })
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn(`[email] Resend send failed (${response.status}): ${body}`);
      return { sent: false };
    }

    const data = await response.json();
    logger.info(`[email] Sent "${subject}" to ${to} (id: ${data.id})`);
    return { sent: true, id: data.id };
  } catch (err) {
    logger.warn(`[email] Send threw: ${err.message}`);
    return { sent: false };
  }
}

module.exports = { sendEmail };
