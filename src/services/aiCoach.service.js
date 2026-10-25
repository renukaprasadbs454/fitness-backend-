const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";

function fallbackCoachReply(message) {
  const trimmed = String(message || "").trim();

  if (!trimmed) {
    return "I’m here to help you stay consistent with your fitness plan.";
  }

  return `I’m in offline coach mode right now, but based on your message — “${trimmed}” — the best next step is to keep the routine simple, stay consistent, and log your progress in the app.`;
}

async function generateCoachReply(userId, payload) {
  const message = String(payload?.message || "").trim();

  if (!GEMINI_API_KEY) {
    return fallbackCoachReply(message);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a friendly fitness coach. Reply in a warm, concise, motivating tone. Keep answers short and actionable. User message: ${message}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const payloadResponse = await response.json();

    if (!response.ok) {
      throw new Error(payloadResponse?.error?.message || "Gemini request failed");
    }

    const text = payloadResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }

    return fallbackCoachReply(message);
  } catch {
    return fallbackCoachReply(message);
  }
}

module.exports = { generateCoachReply };
