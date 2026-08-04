import { Resend } from "resend";

// Injectable seam so the send/error branches are unit-testable without a live
// Resend key. null => resolve the real client from env (production behavior).
let _resendOverride: Resend | null | undefined;

function getResend(): Resend | null {
  if (_resendOverride !== undefined) return _resendOverride;
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

/** Test-only injection point. Pass null to simulate "not configured", or undefined to reset. */
export function _setResendForTesting(client: Resend | null | undefined): void {
  _resendOverride = client;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeSubject(str: string): string {
  // Remove control characters (CR, LF) to prevent header injection
  return str.replace(/[\r\n]/g, "").trim();
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log("[Email] Resend not configured, skipping email:", params.subject);
    return false;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@dcms.local",
      to: params.to,
      subject: sanitizeSubject(params.subject),
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

export function applicantStatusEmail(
  name: string,
  status: "accepted" | "rejected",
  windowTitle: string
): { subject: string; html: string } {
  const isAccepted = status === "accepted";
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(windowTitle);
  const safeSubjectTitle = sanitizeSubject(windowTitle);
  return {
    subject: `Application ${isAccepted ? "Accepted" : "Update"} — ${safeSubjectTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application ${isAccepted ? "Accepted" : "Update"}</h2>
        <p>Dear ${safeName},</p>
        <p>
          Your application for <strong>${safeTitle}</strong> has been 
          <strong>${isAccepted ? "accepted" : "not accepted"}</strong>.
        </p>
        ${isAccepted ? "<p>Welcome to the club! You will receive further instructions shortly.</p>" : "<p>We wish you all the best in your future endeavors.</p>"}
        <br />
        <p>Best regards,<br/>Drama Club Management</p>
      </div>
    `,
  };
}
