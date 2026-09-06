export function createWelcomeEmailTemplate(name, clientURL) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Havn</title>
  </head>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #3A332B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FAF7F2;">
    <div style="background-color: #C2410C; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
      <div style="color: #FFF7ED; font-size: 22px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Havn</div>
      <h1 style="color: #FFFFFF; margin: 0; font-size: 26px; font-weight: 600;">Welcome to Havn</h1>
    </div>
    <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #C2410C;"><strong>Hello ${name},</strong></p>
      <p>Havn is a calmer place to talk. Your account is ready — keep your conversations with friends, family, and colleagues in one quiet, private place.</p>

      <div style="background-color: #F0EAE1; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #C2410C;">
        <p style="font-size: 16px; margin: 0 0 15px 0;"><strong>Get started in just a few steps:</strong></p>
        <ul style="padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 10px;">Set up your profile picture</li>
          <li style="margin-bottom: 10px;">Find and add people you know</li>
          <li style="margin-bottom: 10px;">Start a conversation</li>
          <li style="margin-bottom: 0;">Share photos, voice notes, and more</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href=${clientURL} style="background-color: #C2410C; color: #FFFFFF; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; display: inline-block;">Open Havn</a>
      </div>

      <p style="margin-bottom: 5px;">If you need any help or have questions, we're always here to assist you.</p>
      <p style="margin-top: 0;">Talk soon.</p>

      <p style="margin-top: 25px; margin-bottom: 0;">Best regards,<br>The Havn Team</p>
    </div>

    <div style="text-align: center; padding: 20px; color: #A59989; font-size: 12px;">
      <p>© 2026 Havn. All rights reserved.</p>
      <p>
        <a href="#" style="color: #C2410C; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
        <a href="#" style="color: #C2410C; text-decoration: none; margin: 0 10px;">Terms of Service</a>
        <a href="#" style="color: #C2410C; text-decoration: none; margin: 0 10px;">Contact Us</a>
      </p>
    </div>
  </body>
  </html>
  `;
}

export function createOTPEmailTemplate(name, otp) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your Havn account</title>
  </head>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #3A332B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FAF7F2;">
    <div style="background-color: #C2410C; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <div style="color: #FFF7ED; font-size: 20px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Havn</div>
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600;">Verify your email</h1>
    </div>
    <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center;">
      <p style="font-size: 18px; color: #C2410C;"><strong>Hello ${name},</strong></p>
      <p>Use the code below to verify your Havn account. It expires in 10 minutes.</p>

      <div style="background-color: #F0EAE1; padding: 20px; border-radius: 10px; margin: 25px 0; display: inline-block;">
        <span style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #3A332B;">${otp}</span>
      </div>

      <p style="color: #A59989; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </body>
  </html>
  `;
}
