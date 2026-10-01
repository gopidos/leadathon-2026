// Registration validation + persistence.
//  - Validates the full multi-step team payload.
//  - With MySQL configured: inserts a registration row + one participant row
//    per member (each with a cryptographically random qr_token), then best-effort
//    emails each participant their QR pass via Resend.
//  - Otherwise: appends to a local registrations.json (dev fallback).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { query, withTransaction, configured } = require('./db');
const { qrDataUrl } = require('./qr');
const { sendQrEmail } = require('./email');

const LOCAL_FILE = path.join(__dirname, '..', 'registrations.json');
const PROFILES = ['Student', 'Working Professional', 'Entrepreneur', 'Job Seeker', 'Research Scientist'];
const STAGES = ['Ideation', 'Working Prototype'];
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
const cleanPhone = (v) => String(v || '').replace(/\D/g, '');
const genToken = () => crypto.randomBytes(24).toString('base64url'); // 192-bit, unguessable
const genId = () => crypto.randomUUID();

function validate(body) {
  const b = body || {};
  const teamName = String(b.teamName || '').trim();
  if (teamName.length < 2) return { ok: false, error: 'Please enter your team name.' };

  if (!Array.isArray(b.participants) || b.participants.length < 1 || b.participants.length > 5) {
    return { ok: false, error: 'A team must have 1–5 participants.' };
  }

  const participants = [];
  for (let i = 0; i < b.participants.length; i++) {
    const p = b.participants[i] || {};
    const name = String(p.name || '').trim();
    const phone = cleanPhone(p.phone);
    const email = String(p.email || '').trim().toLowerCase();
    const profile = String(p.profile || '').trim();
    if (name.length < 2) return { ok: false, error: `Participant ${i + 1}: name is required.` };
    if (phone.length !== 10) return { ok: false, error: `Participant ${i + 1}: valid 10-digit mobile required.` };
    if (!isEmail(email)) return { ok: false, error: `Participant ${i + 1}: valid email required.` };
    if (!PROFILES.includes(profile)) return { ok: false, error: `Participant ${i + 1}: select a valid profile.` };
    const row = { idx: i + 1, name, phone, email, profile, institution: null };
    if (profile === 'Student') {
      const institution = String(p.institution || '').trim();
      if (institution.length < 2) return { ok: false, error: `Participant ${i + 1}: institution is required for students.` };
      row.institution = institution;
    }
    participants.push(row);
  }

  const problemCategory = String(b.problemCategory || '').trim();
  if (problemCategory.length < 2) return { ok: false, error: 'Please select a challenge category.' };
  const problemCode = String(b.problemCode || '').trim();
  const problemTitle = String(b.problemTitle || '').trim();
  if (problemTitle.length < 2) return { ok: false, error: 'Please select a problem statement.' };
  const problemStatement = String(b.problemStatement || '').trim() || `${problemCategory} — ${problemCode} — ${problemTitle}`;

  const projectStage = String(b.projectStage || '').trim();
  if (!STAGES.includes(projectStage)) return { ok: false, error: 'Please select a valid project stage.' };
  if (b.consent !== true) return { ok: false, error: 'Consent is required to register.' };

  const lead = participants[0];
  const registration = {
    team_name: teamName,
    participants_count: participants.length,
    problem_category: problemCategory,
    problem_code: problemCode || null,
    problem_title: problemTitle,
    problem_statement: problemStatement,
    project_stage: projectStage,
    idea_summary: String(b.ideaSummary || '').trim() || null,
    consent: true,
    primary_name: lead.name,
    primary_phone: lead.phone,
    primary_email: lead.email,
  };
  return { ok: true, registration, participants };
}

async function emailParticipant(part, registration) {
  const url = `${process.env.PUBLIC_BASE_URL || ''}/verify?t=${part.qr_token}`;
  const dataUrl = await qrDataUrl(url || part.qr_token);
  const result = await sendQrEmail({
    to: part.email,
    participantName: part.name,
    teamName: registration.team_name,
    problem: registration.problem_title,
    code: registration.problem_code,
    qrDataUrl: dataUrl,
  });
  if (result.sent && part.id) {
    try { await query('UPDATE participants SET email_sent_at = ? WHERE id = ?', [new Date(), part.id]); } catch (_) {}
  }
  return result;
}

function insertLocal(registration, participants) {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); } catch (_) {}
  list.push({ ...registration, created_at: new Date().toISOString(), participants });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(list, null, 2));
}

async function handleRegistration(payload) {
  const v = validate(payload || {});
  if (!v.ok) return { status: 400, body: { ok: false, error: v.error } };

  // attach a secure token to each participant up front
  v.participants.forEach((p) => { p.qr_token = genToken(); });

  if (!configured()) {
    try {
      insertLocal(v.registration, v.participants);
      return { status: 200, body: { ok: true, storage: 'local', emailed: 0 } };
    } catch (err) {
      console.error('Local save error:', err.message);
      return { status: 500, body: { ok: false, error: 'Could not save registration.' } };
    }
  }

  try {
    v.registration.id = genId();
    v.participants.forEach((p) => { p.id = genId(); p.registration_id = v.registration.id; });

    await withTransaction(async (conn) => {
      const r = v.registration;
      await conn.execute(
        `INSERT INTO registrations
          (id, team_name, participants_count, problem_category, problem_code, problem_title,
           problem_statement, project_stage, idea_summary, consent, primary_name, primary_phone, primary_email)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [r.id, r.team_name, r.participants_count, r.problem_category, r.problem_code, r.problem_title,
         r.problem_statement, r.project_stage, r.idea_summary, r.consent, r.primary_name, r.primary_phone, r.primary_email]
      );
      for (const p of v.participants) {
        await conn.execute(
          `INSERT INTO participants (id, registration_id, idx, name, phone, email, profile, institution, qr_token)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [p.id, p.registration_id, p.idx, p.name, p.phone, p.email, p.profile, p.institution, p.qr_token]
        );
      }
    });

    const reg = v.registration;
    const inserted = v.participants;

    // best-effort emails (never fail the registration on email errors)
    let emailed = 0;
    for (const part of inserted) {
      try { const r = await emailParticipant(part, v.registration); if (r.sent) emailed++; }
      catch (e) { console.error('Email error:', e.message); }
    }
    return { status: 200, body: { ok: true, storage: 'mysql', registrationId: reg.id, participants: inserted.length, emailed } };
  } catch (err) {
    console.error('Registration error:', err.message);
    return { status: 500, body: { ok: false, error: 'Could not save registration. Please try again.' } };
  }
}

module.exports = { handleRegistration, validate };
