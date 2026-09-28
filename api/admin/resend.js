// POST /api/admin/resend { participantId } -> re-send the QR pass email. (admin only)
const { isAdmin } = require('../../lib/admin-auth');
const { sbSelect, sbUpdate } = require('../../lib/supabase');
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
    const rows = await sbSelect('participants', `?id=eq.${encodeURIComponent(id)}&select=*,registrations(*)`);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Participant not found' });
    const p = rows[0];
    const reg = p.registrations || {};
    const url = `${process.env.PUBLIC_BASE_URL || ''}/verify?t=${p.qr_token}`;
    const dataUrl = await qrDataUrl(url);
    const result = await sendQrEmail({
      to: p.email, participantName: p.name, teamName: reg.team_name,
      problem: reg.problem_title, code: reg.problem_code, qrDataUrl: dataUrl,
    });
    if (!result.sent) return res.status(502).json({ ok: false, error: 'Email not sent: ' + (result.reason || 'unknown') });
    try { await sbUpdate('participants', `?id=eq.${p.id}`, { email_sent_at: new Date().toISOString() }); } catch (_) {}
    res.status(200).json({ ok: true, id: result.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
