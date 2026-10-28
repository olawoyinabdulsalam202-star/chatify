import { ENV } from "./env.js";

// Brevo's transactional Send API v3 — plain REST call, no SDK needed.
// Docs: https://developers.brevo.com/reference/sendtransacemail
const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export const sendEmail = async ({ to, toName, subject, html }) => {
  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": ENV.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: ENV.EMAIL_FROM,
        name: ENV.EMAIL_FROM_NAME,
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Brevo send error:", JSON.stringify(data));
    throw new Error("Failed to send email via Brevo");
  }

  return data;
};
