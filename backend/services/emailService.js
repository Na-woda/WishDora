// services/emailService.js
const nodemailer = require('nodemailer');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function normalizeCloudinaryImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  const trimmed = imageUrl.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|data:image\/)/i.test(trimmed)) return trimmed;
  return '';
}

function resolveCardImageUrl(wish) {
  const candidateValues = [
    wish?.cardImage,
    wish?.imageUrl,
    wish?.selectedCard?.imageUrl,
    wish?.selectedCardId?.imageUrl,
  ];

  for (const candidate of candidateValues) {
    const normalized = normalizeCloudinaryImageUrl(candidate);
    if (normalized) return normalized;
  }

  return '';
}

// Create reusable transporter using Gmail SMTP with timeouts suitable for Serverless
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.GMAIL_USER || process.env.EMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

/**
 * Build the beautiful HTML email body
 */
function buildEmailHTML(wish) {
  const imageUrl = resolveCardImageUrl(wish);
  console.log('[Email] Final image URL before building email:', imageUrl || '(missing)');

  const cardSection = imageUrl
    ? `<div style="text-align:center;margin:20px 0;">
         <img src="${imageUrl}" alt="Greeting Card"
              style="max-width:280px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,0.15);">
       </div>`
    : '';

  console.log('[Email] HTML image src:', imageUrl || '(no valid image)');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${wish.greeting}</title>
</head>
<body style="margin:0;padding:0;background:#fdf8f3;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f3;padding:30px 0;">
    <tr><td align="center">

      <!-- Card -->
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:20px;overflow:hidden;
                    box-shadow:0 8px 30px rgba(120,50,10,0.12);max-width:560px;width:100%;">

        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#c25c0c,#e8782a);padding:36px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">🎉</div>
            <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0;letter-spacing:-0.5px;">
              ${wish.greeting}!
            </h1>
            <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:8px 0 0;letter-spacing:1px;">
              A special message from WishDora 💌
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <p style="font-size:18px;font-weight:600;color:#1e120a;margin:0 0 6px;">
              Dear ${wish.receiverName},
            </p>

            <p style="color:#5c3d25;font-size:15px;line-height:1.8;margin:16px 0 24px;
                      background:#fdf4e8;border-left:4px solid #c25c0c;
                      padding:16px 20px;border-radius:0 10px 10px 0;">
              ${wish.message.replace(/\n/g, '<br>')}
            </p>

            ${cardSection}

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f0e4d4;">
              <p style="color:#9a7860;font-size:13px;margin:0;">With warm wishes,</p>
              <p style="color:#1e120a;font-size:16px;font-weight:600;margin:4px 0 0;">
                ${wish.senderName}
              </p>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fdf4e8;padding:18px 40px;text-align:center;
                     border-top:1px solid #f0e4d4;">
            <p style="color:#9a7860;font-size:12px;margin:0;line-height:1.6;">
              Sent with love via <strong style="color:#c25c0c;">WishDora</strong> ·
              <em>Never let a special day feel forgotten</em>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

/**
 * Send wish via email
 */
async function sendWishEmail(wish) {
  console.log('[Email] Scheduled wish payload:', JSON.stringify({
    id: wish._id,
    receiverEmail: wish.receiverEmail,
    cardImage: wish.cardImage || '',
    selectedCardId: wish.selectedCardId || null,
  }));

  const mailOptions = {
    from: `"${wish.senderName} via WishDora" <${process.env.GMAIL_USER}>`,
    to: wish.receiverEmail,
    replyTo: wish.senderEmail,
    subject: `🎉 ${wish.greeting}, ${wish.receiverName}!`,
    html: buildEmailHTML(wish),
    text: `${wish.greeting}, ${wish.receiverName}!\n\n${wish.message}\n\nWith warm wishes,\n${wish.senderName}\n\nSent via WishDora`,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`📧 Email sent to ${wish.receiverEmail} | MsgID: ${info.messageId}`);
  return info;
}

/** Send product feedback to the private recipient configured on the server. */
async function sendFeedbackEmail(feedback) {
  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL;
  /*if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !recipient) {
    throw new Error('Feedback email delivery is not configured.');
  }*/

  const submittedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }) + ' UTC';
  const name = escapeHtml(feedback.userName || 'Guest');
  const email = escapeHtml(feedback.userEmail || 'Not provided');
  const suggestion = escapeHtml(feedback.suggestion || 'No written feedback provided.').replace(/\n/g, '<br>');
  const rating = Number(feedback.rating);
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return transporter.sendMail({
    from: `"WishDora Feedback" <${process.env.GMAIL_USER}>`,
    to: recipient,
    replyTo: feedback.userEmail || undefined,
    subject: `New WishDora feedback: ${rating}/5`,
    text: `New WishDora feedback\n\nRating: ${rating}/5 (${stars})\nComment: ${feedback.suggestion || 'None'}\nStore recommendations: ${feedback.storeRecommendation}\nWould recommend: ${feedback.recommendFriend ? 'Yes' : 'No'}\nUser: ${feedback.userName || 'Guest'}\nEmail: ${feedback.userEmail || 'Not provided'}\nUser ID: ${feedback.userId || 'Not provided'}\nSubmitted: ${submittedAt}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1e120a">
      <div style="padding:22px 26px;background:linear-gradient(135deg,#c25c0c,#e8782a);color:#fff;border-radius:14px 14px 0 0"><h1 style="margin:0;font-size:22px">New WishDora feedback</h1></div>
      <div style="padding:24px 26px;background:#fdf8f3;border:1px solid #f0e4d4;border-top:0;border-radius:0 0 14px 14px">
        <p style="font-size:22px;color:#c25c0c;margin:0 0 18px">${stars} <strong>${rating}/5</strong></p>
        <p><strong>Comment</strong><br>${suggestion}</p>
        <p><strong>Store recommendations:</strong> ${escapeHtml(feedback.storeRecommendation)}</p>
        <p><strong>Would recommend:</strong> ${feedback.recommendFriend ? 'Yes' : 'No'}</p>
        <hr style="border:0;border-top:1px solid #eadaca"><p><strong>User:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>User ID:</strong> ${escapeHtml(feedback.userId || 'Not provided')}<br><strong>Submitted:</strong> ${submittedAt}</p>
      </div></div>`,
  });
}

/**
 * Send account welcome email
 */
async function sendWelcomeEmail(user) {
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#c25c0c,#e8782a);padding:30px;text-align:center;">
        <div style="font-size:36px;">🎂</div>
        <h2 style="color:#fff;margin:10px 0 0;">Welcome to WishDora!</h2>
      </div>
      <div style="padding:30px;">
        <p style="font-size:16px;color:#1e120a;">Hi <strong>${user.name}</strong>,</p>
        <p style="color:#5c3d25;line-height:1.7;">Your account is ready! Never let a birthday, anniversary, or special day go by unnoticed again.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard.html"
             style="background:linear-gradient(135deg,#c25c0c,#e8782a);color:#fff;padding:12px 32px;
                    border-radius:50px;text-decoration:none;font-weight:600;font-size:15px;">
            🎁 Schedule Your First Wish
          </a>
        </div>
        <p style="color:#9a7860;font-size:13px;">With love,<br>The WishDora Team 💌</p>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `"WishDora" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: '🎉 Welcome to WishDora – Your wish scheduler is ready!',
    html,
  });
}

/**
 * Send password reset OTP email
 */
async function sendOtpEmail(email, name, otp) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Password Reset OTP - WishDora</title>
    </head>
    <body style="margin:0;padding:0;background:#fdf8f3;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f3;padding:30px 0;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:20px;overflow:hidden;
                        box-shadow:0 8px 30px rgba(120,50,10,0.12);max-width:520px;width:100%;">
            <tr>
              <td style="background:linear-gradient(135deg,#c25c0c,#e8782a);padding:32px 36px;text-align:center;">
                <div style="font-size:38px;margin-bottom:8px;">🔒</div>
                <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">
                  Password Reset Request
                </h1>
                <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;">
                  WishDora Security Verification
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px;">
                <p style="font-size:16px;font-weight:600;color:#1e120a;margin:0 0 10px;">
                  Hello ${name || 'User'},
                </p>
                <p style="color:#5c3d25;font-size:14px;line-height:1.7;margin:0 0 20px;">
                  We received a request to reset your WishDora account password. Use the single-use Verification Code below to complete the process:
                </p>

                <!-- OTP Box -->
                <div style="background:#fdf4e8;border:2px dashed #e8782a;border-radius:14px;padding:20px;text-align:center;margin:24px 0;">
                  <div style="font-size:12px;font-weight:600;color:#9a7860;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                    Your Verification Code
                  </div>
                  <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#c25c0c;font-family:monospace;">
                    ${otp}
                  </div>
                  <div style="font-size:12px;color:#9a7860;margin-top:8px;">
                    ⏱️ Code expires in <strong>10 minutes</strong>
                  </div>
                </div>

                <p style="color:#785840;font-size:13px;line-height:1.6;margin:0 0 20px;">
                  If you did not request a password reset, please ignore this email or contact support if you have security concerns.
                </p>

                <div style="padding-top:20px;border-top:1px solid #f0e4d4;text-align:center;">
                  <p style="color:#9a7860;font-size:12px;margin:0;">
                    With care,<br><strong style="color:#c25c0c;">The WishDora Team 💌</strong>
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`;

  await transporter.sendMail({
    from: `"WishDora Security" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `🔑 ${otp} is your WishDora password reset code`,
    html,
  });
}

module.exports = { sendWishEmail, sendWelcomeEmail, sendOtpEmail, sendFeedbackEmail };
