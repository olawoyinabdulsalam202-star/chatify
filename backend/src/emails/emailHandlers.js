import { sendEmail } from "../lib/brevo.js";
import { createWelcomeEmailTemplate, createOTPEmailTemplate } from "../emails/emailTemplate.js";

export const sendWelcomeEmail = async (email, name, clientURL) => {
  await sendEmail({
    to: email,
    toName: name,
    subject: "Welcome to Havn",
    html: createWelcomeEmailTemplate(name, clientURL),
  });

  console.log("Welcome email sent successfully to", email);
};

export const sendOTPEmail = async (email, name, otp) => {
  await sendEmail({
    to: email,
    toName: name,
    subject: "Your Havn verification code",
    html: createOTPEmailTemplate(name, otp),
  });

  console.log("OTP email sent successfully to", email);
};
