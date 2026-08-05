type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
        character
      ] ?? character,
  );

export function isRecoveryEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ROOM_EQ_EMAIL_FROM);
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ROOM_EQ_EMAIL_FROM;
  const supportEmail =
    process.env.ROOM_EQ_SUPPORT_EMAIL ?? "m.gough@irishpanda.com";

  if (!apiKey || !from) {
    throw new Error("Password recovery email is not configured.");
  }

  const safeResetUrl = escapeHtml(resetUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `room-eq-password-reset-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: supportEmail,
      subject: "Reset your Room EQ Assistant password",
      text: [
        "A password reset was requested for your Room EQ Assistant account.",
        "",
        `Reset your password: ${resetUrl}`,
        "",
        "This link expires in one hour. If you did not request it, you can ignore this email.",
        "",
        `Support: ${supportEmail}`,
      ].join("\n"),
      html: `
        <div style="background:#f7f5ee;color:#101715;font-family:Arial,sans-serif;padding:32px 16px">
          <div style="background:#fcfbf7;border:1px solid #d7d2c7;border-radius:8px;margin:0 auto;max-width:560px;padding:32px">
            <p style="font-size:12px;font-weight:800;letter-spacing:.12em;margin:0 0 18px;text-transform:uppercase">Room EQ Assistant</p>
            <h1 style="font-size:30px;line-height:1.1;margin:0 0 16px">Reset your password</h1>
            <p style="line-height:1.6;margin:0 0 24px">A password reset was requested for your account.</p>
            <p style="margin:0 0 24px"><a href="${safeResetUrl}" style="background:#101715;border-radius:4px;color:#fff;display:inline-block;font-weight:700;padding:13px 18px;text-decoration:none">Choose a new password</a></p>
            <p style="color:#66706c;font-size:13px;line-height:1.6;margin:0">This link expires in one hour. If you did not request it, you can ignore this email. For help, email <a href="mailto:${escapeHtml(supportEmail)}" style="color:#101715">${escapeHtml(supportEmail)}</a>.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `Password recovery email could not be sent${requestId ? ` (${requestId})` : ""}.`,
    );
  }
}
