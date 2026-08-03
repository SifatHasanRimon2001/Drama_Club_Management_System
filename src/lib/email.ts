import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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
