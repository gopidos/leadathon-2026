// POST /api/admin/resend { participantId } -> re-send the QR pass email. (admin only)
const { isAdmin } = require('../../lib/admin-auth');
const { query } = require('../../lib/db');
const { qrDataUrl } = require('../../lib/qr');
const { sendQrEmail } = require('../../lib/email');

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
  const id = b && b.participantId;
  if (!id) return res.status(400).json({ ok: false, error: 'participantId required' });

  try {
    const rows = await query(
      `SELECT participants.*,
              registrations.team_name     AS reg_team_name,
              registrations.problem_title AS reg_problem_title,
              registrations.problem_code  AS reg_problem_code
         FROM participants
         JOIN registrations ON registrations.id = participants.registration_id
        WHERE participants.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Participant not found' });
    const p = rows[0];
    const url = `${process.env.PUBLIC_BASE_URL || ''}/verify?t=${p.qr_token}`;
    const dataUrl = await qrDataUrl(url);
    const result = await sendQrEmail({
      to: p.email, participantName: p.name, teamName: p.reg_team_name,
      problem: p.reg_problem_title, code: p.reg_problem_code, qrDataUrl: dataUrl,
    });
    if (!result.sent) return res.status(502).json({ ok: false, error: 'Email not sent: ' + (result.reason || 'unknown') });
    try { await query('UPDATE participants SET email_sent_at = ? WHERE id = ?', [new Date(), p.id]); } catch (_) {}
    res.status(200).json({ ok: true, id: result.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
