// Send a participant their secure QR pass via Resend.
const { Resend } = require('resend');

function passHtml({ participantName, teamName, problem, code }) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f2ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0c0d2b">
    <div style="max-width:520px;margin:0 auto;padding:28px 20px">
      <div style="background:#030164;border-radius:16px 16px 0 0;padding:26px 28px;color:#fff">
        <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#FFD758;font-weight:700">LEADATHON 2026</div>
        <div style="font-size:22px;font-weight:700;margin-top:6px">Your Event QR Pass</div>
      </div>
      <div style="background:#fff;border:1px solid #e7e4dc;border-top:none;border-radius:0 0 16px 16px;padding:28px">
        <p style="margin:0 0 4px">Hi <strong>${escapeHtml(participantName)}</strong>,</p>
        <p style="margin:0 0 18px;color:#5b5f7d">You're registered for LEADATHON 2026 with team <strong>${escapeHtml(teamName)}</strong>. This QR pass is unique to you — please keep it private and bring it to the venue for check-in.</p>
        <div style="text-align:center;padding:18px;background:#f7f8fc;border:1px solid #eceaf3;border-radius:14px">
          <img src="cid:qrpass" alt="Your QR pass" width="240" height="240" style="display:block;margin:0 auto;border-radius:8px" />
          <div style="margin-top:12px;font-size:13px;color:#5b5f7d">Scan at the LEADATHON check-in desk</div>
        </div>
        <table style="width:100%;margin-top:20px;font-size:14px;border-collapse:collapse">
          <tr><td style="color:#5b5f7d;padding:5px 0">Team</td><td style="text-align:right;font-weight:600">${escapeHtml(teamName)}</td></tr>
          <tr><td style="color:#5b5f7d;padding:5px 0">Problem</td><td style="text-align:right;font-weight:600">${escapeHtml(code || '')} ${escapeHtml(problem || '')}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#9498b5">This pass is personal and non-transferable. If you didn't register for LEADATHON 2026, please ignore this email.</p>
      </div>
      <div style="text-align:center;color:#9498b5;font-size:12px;margin-top:16px">We The Leaders Foundation · Manapparai, Tamil Nadu</div>
    </div></body></html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// qrDataUrl = "data:image/png;base64,...."
async function sendQrEmail({ to, participantName, teamName, problem, code, qrDataUrl }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no_resend_key' };
  const resend = new Resend(key);
  const from = process.env.RESEND_FROM || 'LEADATHON 2026 <onboarding@resend.dev>';
  const base64 = (qrDataUrl || '').split(',')[1] || '';

  try {
    const res = await resend.emails.send({
      from,
      to,
      subject: `Your LEADATHON 2026 QR Pass — ${teamName}`,
      html: passHtml({ participantName, teamName, problem, code }),
      attachments: [{ filename: 'leadathon-qr-pass.png', content: base64, content_id: 'qrpass' }],
    });
    if (res.error) return { sent: false, reason: res.error.message || 'resend_error' };
    return { sent: true, id: res.data && res.data.id };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

module.exports = { sendQrEmail };
