/**
 * ArtDera Email Service
 *
 * Supports multiple email sending backends:
 * 1. Gmail SMTP via Nodemailer (Recommended for sending directly from artdera4@gmail.com without buying a custom domain)
 * 2. EmailJS REST API
 * 3. Resend API
 * 4. Development Console Fallback
 *
 * IMPORTANT: This file is server-only.
 */

import { getEnv } from "../config/env";

// ---------------------------------------------------------------------------
// HTML email template
// ---------------------------------------------------------------------------

function buildPasswordResetHtml(recipientName: string, resetUrl: string): string {
  const firstName = recipientName.split(" ")[0] ?? recipientName;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your ArtDera password</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f1e8;padding:40px 0;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-family:'Georgia',serif;font-size:22px;font-weight:700;color:#171717;letter-spacing:0.06em;">ARTDERA</span>
            </td>
          </tr>
          <!-- Body card -->
          <tr>
            <td style="background-color:#fffdfc;border-radius:16px;border:1px solid #e8e2d8;overflow:hidden;">
              <!-- Top accent bar -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:#6e2334;height:4px;"></td>
                </tr>
              </table>
              <!-- Content -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:40px 44px 36px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89f94;">Security</p>
                    <h1 style="margin:0 0 20px;font-size:28px;font-weight:400;color:#171717;font-family:'Georgia',serif;line-height:1.25;">Reset your password</h1>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a4a;">Hi ${escapeHtml(firstName)},</p>
                    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4a4a4a;">
                      We received a request to reset the password for your ArtDera account.
                      Click the button below to create a new password.
                    </p>
                    <!-- CTA button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                      <tr>
                        <td style="border-radius:999px;background-color:#6e2334;">
                          <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#fffdfc;text-decoration:none;border-radius:999px;letter-spacing:0.02em;">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    <!-- Expiry notice -->
                    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#7a7267;">
                      This link will expire in <strong>30 minutes</strong> and can only be used once.
                    </p>
                    <hr style="border:none;border-top:1px solid #e8e2d8;margin:0 0 24px;" />
                    <!-- Button not working fallback -->
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#7a7267;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;">
                      <a href="${resetUrl}" style="color:#6e2334;text-decoration:underline;">${resetUrl}</a>
                    </p>
                    <hr style="border:none;border-top:1px solid #e8e2d8;margin:0 0 24px;" />
                    <!-- Security note -->
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a7267;">
                      If you didn't request a password reset, you can safely ignore this email.
                      Your password will remain unchanged. For your security, never share this email
                      or the reset link with anyone.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#a89f94;">Regards, The ArtDera Team</p>
              <p style="margin:0 0 6px;font-size:12px;font-style:italic;color:#a89f94;">Discover Art. Shape Your Space.</p>
              <p style="margin:0;font-size:12px;color:#c4b9ad;">
                &copy; ${year} ArtDera &mdash;
                <a href="https://www.artdera.com" style="color:#a89f94;text-decoration:none;">www.artdera.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface EmailResult {
  ok: boolean;
  error?: string;
}


export async function sendEmailMessage(
  recipientEmail: string,
  subject: string,
  html: string,
  templateParams?: Record<string, string>,
): Promise<EmailResult> {
  const env = getEnv();

  // 1. Gmail SMTP via Nodemailer
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    try {
      const nodemailer = await import("nodemailer");
      const cleanPassword = env.GMAIL_APP_PASSWORD.replace(/\s+/g, "");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: env.GMAIL_USER.trim(),
          pass: cleanPassword,
        },
      });

      await transporter.sendMail({
        from: env.EMAIL_FROM || `ArtDera <${env.GMAIL_USER}>`,
        to: recipientEmail,
        subject,
        html,
      });

      console.info(`[email] Successfully sent email via Gmail SMTP to ${recipientEmail}`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gmail SMTP error";
      console.error("[email] Failed to send via Gmail SMTP:", message);
      return { ok: false, error: message };
    }
  }

  // 2. EmailJS REST API
  if (env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY) {
    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: env.EMAILJS_SERVICE_ID,
          template_id: env.EMAILJS_TEMPLATE_ID,
          user_id: env.EMAILJS_PUBLIC_KEY,
          accessToken: env.EMAILJS_PRIVATE_KEY,
          template_params: {
            to_email: recipientEmail,
            subject,
            ...(templateParams ?? {}),
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[email] EmailJS API error:", text);
        return { ok: false, error: text || "EmailJS failed" };
      }

      console.info(`[email] Successfully sent email via EmailJS to ${recipientEmail}`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "EmailJS network error";
      console.error("[email] Failed to send via EmailJS:", message);
      return { ok: false, error: message };
    }
  }

  // 3. Resend API
  if (env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipientEmail,
        subject,
        html,
      });

      if (error) {
        console.error("[email] Resend returned an error:", error.message);
        return { ok: false, error: error.message };
      }

      console.info(`[email] Successfully sent email via Resend to ${recipientEmail}`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Resend send error";
      console.error("[email] Failed to send via Resend:", message);
      return { ok: false, error: message };
    }
  }

  if (env.NODE_ENV === "production") {
    console.error("[email] Email delivery is not configured");
    return { ok: false, error: "Email delivery is not configured" };
  }

  console.info("📧  [EMAIL — dev console fallback]");
  console.info(`  To:      ${recipientEmail}`);
  console.info(`  Subject: ${subject}`);
  if (templateParams?.reset_url) {
    console.info(`  Reset URL: ${templateParams.reset_url}`);
  }
  return { ok: true };
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  recipientName: string,
  resetUrl: string,
): Promise<EmailResult> {
  const subject = "Reset your ArtDera password";
  const html = buildPasswordResetHtml(recipientName, resetUrl);
  return sendEmailMessage(recipientEmail, subject, html, {
    to_name: recipientName,
    reset_url: resetUrl,
  });
}

function buildAccountDeletionSubmittedHtml(recipientName: string, requestId: string): string {
  const firstName = recipientName.split(" ")[0] ?? recipientName;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account Deletion Request Received — ArtDera</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f1e8;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-family:'Georgia',serif;font-size:22px;font-weight:700;color:#171717;letter-spacing:0.06em;">ARTDERA</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fffdfc;border-radius:16px;border:1px solid #e8e2d8;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:#6e2334;height:4px;"></td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:40px 44px 36px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89f94;">Account Security</p>
                    <h1 style="margin:0 0 20px;font-size:28px;font-weight:400;color:#171717;font-family:'Georgia',serif;line-height:1.25;">Account deletion request received</h1>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a4a;">Hi ${escapeHtml(firstName)},</p>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a4a;">
                      We have received your account deletion request for ArtDera.
                    </p>
                    <div style="background-color:#f8f6f2;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #ebe5da;">
                      <p style="margin:0 0 6px;font-size:12px;color:#7a7267;text-transform:uppercase;letter-spacing:0.08em;">Request Reference</p>
                      <p style="margin:0;font-size:18px;font-weight:700;color:#6e2334;font-family:monospace;">${escapeHtml(requestId)}</p>
                    </div>
                    <h3 style="margin:24px 0 12px;font-size:16px;font-weight:600;color:#171717;">What happens next?</h3>
                    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.6;color:#4a4a4a;">
                      <li>An ArtDera administrator will review and verify your request within 3 to 5 business days.</li>
                      <li>Upon approval, your personal profile, credentials, and saved artwork preferences will be permanently erased.</li>
                      <li>Financial transaction records and invoices are retained for legal and tax compliance in accordance with applicable laws.</li>
                    </ul>
                    <hr style="border:none;border-top:1px solid #e8e2d8;margin:0 0 24px;" />
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a7267;">
                      If you did not request account deletion, please contact ArtDera Support immediately at <a href="mailto:support@artdera.com" style="color:#6e2334;text-decoration:underline;">support@artdera.com</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#a89f94;">Regards, The ArtDera Team</p>
              <p style="margin:0;font-size:12px;color:#c4b9ad;">&copy; ${year} ArtDera &mdash; www.artdera.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAccountDeletionProcessedHtml(
  recipientName: string,
  status: "completed" | "rejected",
  rejectionReason?: string,
): string {
  const firstName = recipientName.split(" ")[0] ?? recipientName;
  const year = new Date().getFullYear();
  const isCompleted = status === "completed";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isCompleted ? "Account Deletion Completed" : "Account Deletion Request Update"} — ArtDera</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f1e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f1e8;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-family:'Georgia',serif;font-size:22px;font-weight:700;color:#171717;letter-spacing:0.06em;">ARTDERA</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fffdfc;border-radius:16px;border:1px solid #e8e2d8;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:${isCompleted ? "#1b4332" : "#a83232"};height:4px;"></td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:40px 44px 36px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a89f94;">Account Status Update</p>
                    <h1 style="margin:0 0 20px;font-size:28px;font-weight:400;color:#171717;font-family:'Georgia',serif;line-height:1.25;">
                      ${isCompleted ? "Account and data deleted" : "Deletion request declined"}
                    </h1>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a4a;">Hi ${escapeHtml(firstName)},</p>
                    ${
                      isCompleted
                        ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a4a;">
                            Your ArtDera account and associated profile data have been permanently deleted in accordance with your request.
                          </p>
                          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#7a7267;">
                            All personal data, login access, preferences, and store listings have been erased. Mandatory transaction invoices and tax records are retained securely as required by financial regulations.
                          </p>`
                        : `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4a4a;">
                            Your request to delete your ArtDera account could not be processed at this time.
                          </p>
                          <div style="background-color:#fdf2f2;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #f8d7da;">
                            <p style="margin:0 0 6px;font-size:12px;color:#a83232;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Reason</p>
                            <p style="margin:0;font-size:14px;color:#4a4a4a;">${escapeHtml(rejectionReason || "Ownership verification could not be completed.")}</p>
                          </div>`
                    }
                    <hr style="border:none;border-top:1px solid #e8e2d8;margin:0 0 24px;" />
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a7267;">
                      If you have any questions, you can contact our team anytime at <a href="mailto:support@artdera.com" style="color:#6e2334;text-decoration:underline;">support@artdera.com</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#a89f94;">Regards, The ArtDera Team</p>
              <p style="margin:0;font-size:12px;color:#c4b9ad;">&copy; ${year} ArtDera &mdash; www.artdera.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAccountDeletionSubmittedEmail(
  recipientEmail: string,
  recipientName: string,
  requestId: string,
): Promise<EmailResult> {
  const subject = "Account Deletion Request Received — ArtDera";
  const html = buildAccountDeletionSubmittedHtml(recipientName, requestId);
  return sendEmailMessage(recipientEmail, subject, html, {
    to_name: recipientName,
    request_id: requestId,
  });
}

export async function sendAccountDeletionProcessedEmail(
  recipientEmail: string,
  recipientName: string,
  status: "completed" | "rejected",
  rejectionReason?: string,
): Promise<EmailResult> {
  const subject =
    status === "completed"
      ? "Account Deletion Completed — ArtDera"
      : "Account Deletion Request Update — ArtDera";
  const html = buildAccountDeletionProcessedHtml(recipientName, status, rejectionReason);
  return sendEmailMessage(recipientEmail, subject, html, {
    to_name: recipientName,
    status,
    rejection_reason: rejectionReason ?? "",
  });
}

