<?php
// Registration validation + persistence.
//  - Validates the full multi-step team payload.
//  - With MySQL configured: inserts a registration row + one participant row
//    per member (each with a cryptographically random qr_token), then best-effort
//    emails each participant their QR pass via Resend.
//  - Otherwise: appends to a local registrations.json (dev fallback).

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/qr.php';
require_once __DIR__ . '/email.php';

const RC_LOCAL_FILE = __DIR__ . '/../registrations.json';
const RC_PROFILES = ['Student', 'Working Professional', 'Entrepreneur', 'Job Seeker', 'Research Scientist'];
const RC_STAGES = ['Ideation', 'Working Prototype'];

function rc_is_email(string $v): bool {
    return (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $v);
}

function rc_clean_phone(string $v): string {
    return preg_replace('/\D/', '', $v) ?? '';
}

function rc_gen_token(): string {
    // 192-bit, unguessable, base64url (matches crypto.randomBytes(24).toString('base64url'))
    return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function rc_gen_id(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// Returns ['ok' => bool, 'error' => ?string, 'registration' => ?array, 'participants' => ?array]
function rc_validate(array $b): array {
    $teamName = trim((string) ($b['teamName'] ?? ''));
    if (strlen($teamName) < 2) return ['ok' => false, 'error' => 'Please enter your team name.'];

    $rawParticipants = $b['participants'] ?? null;
    if (!is_array($rawParticipants) || count($rawParticipants) < 1 || count($rawParticipants) > 5) {
        return ['ok' => false, 'error' => 'A team must have 1–5 participants.'];
    }

    $participants = [];
    $i = 0;
    foreach ($rawParticipants as $p) {
        $i++;
        $p = is_array($p) ? $p : [];
        $name = trim((string) ($p['name'] ?? ''));
        $phone = rc_clean_phone((string) ($p['phone'] ?? ''));
        $email = strtolower(trim((string) ($p['email'] ?? '')));
        $profile = trim((string) ($p['profile'] ?? ''));
        if (strlen($name) < 2) return ['ok' => false, 'error' => "Participant {$i}: name is required."];
        if (strlen($phone) !== 10) return ['ok' => false, 'error' => "Participant {$i}: valid 10-digit mobile required."];
        if (!rc_is_email($email)) return ['ok' => false, 'error' => "Participant {$i}: valid email required."];
        if (!in_array($profile, RC_PROFILES, true)) return ['ok' => false, 'error' => "Participant {$i}: select a valid profile."];
        $row = ['idx' => $i, 'name' => $name, 'phone' => $phone, 'email' => $email, 'profile' => $profile, 'institution' => null];
        if ($profile === 'Student') {
            $institution = trim((string) ($p['institution'] ?? ''));
            if (strlen($institution) < 2) return ['ok' => false, 'error' => "Participant {$i}: institution is required for students."];
            $row['institution'] = $institution;
        }
        $participants[] = $row;
    }

    $problemCategory = trim((string) ($b['problemCategory'] ?? ''));
    if (strlen($problemCategory) < 2) return ['ok' => false, 'error' => 'Please select a challenge category.'];
    $problemCode = trim((string) ($b['problemCode'] ?? ''));
    $problemTitle = trim((string) ($b['problemTitle'] ?? ''));
    if (strlen($problemTitle) < 2) return ['ok' => false, 'error' => 'Please select a problem statement.'];
    $problemStatement = trim((string) ($b['problemStatement'] ?? ''));
    if ($problemStatement === '') $problemStatement = "{$problemCategory} — {$problemCode} — {$problemTitle}";

    $projectStage = trim((string) ($b['projectStage'] ?? ''));
    if (!in_array($projectStage, RC_STAGES, true)) return ['ok' => false, 'error' => 'Please select a valid project stage.'];
    if (($b['consent'] ?? null) !== true) return ['ok' => false, 'error' => 'Consent is required to register.'];

    $lead = $participants[0];
    $ideaSummary = trim((string) ($b['ideaSummary'] ?? ''));
    $registration = [
        'team_name' => $teamName,
        'participants_count' => count($participants),
        'problem_category' => $problemCategory,
        'problem_code' => $problemCode !== '' ? $problemCode : null,
        'problem_title' => $problemTitle,
        'problem_statement' => $problemStatement,
        'project_stage' => $projectStage,
        'idea_summary' => $ideaSummary !== '' ? $ideaSummary : null,
        'consent' => true,
        'primary_name' => $lead['name'],
        'primary_phone' => $lead['phone'],
        'primary_email' => $lead['email'],
    ];
    return ['ok' => true, 'registration' => $registration, 'participants' => $participants];
}

// Returns ['sent' => bool, 'id' => ?string, 'reason' => ?string]
function rc_email_participant(array $part, array $registration): array {
    $base = env('PUBLIC_BASE_URL', '');
    $url = "{$base}/verify?t=" . $part['qr_token'];
    $dataUrl = qr_data_url($url);
    $result = send_qr_email(
        $part['email'],
        $part['name'],
        $registration['team_name'],
        $registration['problem_title'],
        $registration['problem_code'],
        $dataUrl
    );
    if ($result['sent'] && !empty($part['id'])) {
        try {
            db_exec('UPDATE participants SET email_sent_at = ? WHERE id = ?', [date('Y-m-d H:i:s'), $part['id']]);
        } catch (Throwable $e) { /* best-effort */ }
    }
    return $result;
}

function rc_insert_local(array $registration, array $participants): void {
    $list = [];
    if (file_exists(RC_LOCAL_FILE)) {
        $decoded = json_decode(file_get_contents(RC_LOCAL_FILE), true);
        if (is_array($decoded)) $list = $decoded;
    }
    $registration['created_at'] = date('c');
    $registration['participants'] = $participants;
    $list[] = $registration;
    file_put_contents(RC_LOCAL_FILE, json_encode($list, JSON_PRETTY_PRINT));
}

// Returns ['status' => int, 'body' => array]
function handle_registration(array $payload): array {
    $v = rc_validate($payload);
    if (!$v['ok']) return ['status' => 400, 'body' => ['ok' => false, 'error' => $v['error']]];

    // attach a secure token to each participant up front
    foreach ($v['participants'] as &$p) { $p['qr_token'] = rc_gen_token(); }
    unset($p);

    if (!db_configured()) {
        try {
            rc_insert_local($v['registration'], $v['participants']);
            return ['status' => 200, 'body' => ['ok' => true, 'storage' => 'local', 'emailed' => 0]];
        } catch (Throwable $e) {
            error_log('Local save error: ' . $e->getMessage());
            return ['status' => 500, 'body' => ['ok' => false, 'error' => 'Could not save registration.']];
        }
    }

    try {
        $registration = $v['registration'];
        $registration['id'] = rc_gen_id();
        $participants = $v['participants'];
        foreach ($participants as &$p) {
            $p['id'] = rc_gen_id();
            $p['registration_id'] = $registration['id'];
        }
        unset($p);

        db_transaction(function (PDO $pdo) use ($registration, $participants) {
            $r = $registration;
            $stmt = $pdo->prepare(
                'INSERT INTO registrations
                    (id, team_name, participants_count, problem_category, problem_code, problem_title,
                     problem_statement, project_stage, idea_summary, consent, primary_name, primary_phone, primary_email)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $r['id'], $r['team_name'], $r['participants_count'], $r['problem_category'], $r['problem_code'],
                $r['problem_title'], $r['problem_statement'], $r['project_stage'], $r['idea_summary'],
                (int) $r['consent'], $r['primary_name'], $r['primary_phone'], $r['primary_email'],
            ]);

            $pstmt = $pdo->prepare(
                'INSERT INTO participants (id, registration_id, idx, name, phone, email, profile, institution, qr_token)
                 VALUES (?,?,?,?,?,?,?,?,?)'
            );
            foreach ($participants as $p) {
                $pstmt->execute([
                    $p['id'], $p['registration_id'], $p['idx'], $p['name'], $p['phone'],
                    $p['email'], $p['profile'], $p['institution'], $p['qr_token'],
                ]);
            }
        });

        // best-effort emails (never fail the registration on email errors)
        $emailed = 0;
        foreach ($participants as $part) {
            try {
                $r = rc_email_participant($part, $registration);
                if ($r['sent']) $emailed++;
            } catch (Throwable $e) {
                error_log('Email error: ' . $e->getMessage());
            }
        }

        return ['status' => 200, 'body' => [
            'ok' => true, 'storage' => 'mysql', 'registrationId' => $registration['id'],
            'participants' => count($participants), 'emailed' => $emailed,
        ]];
    } catch (Throwable $e) {
        error_log('Registration error: ' . $e->getMessage());
        return ['status' => 500, 'body' => ['ok' => false, 'error' => 'Could not save registration. Please try again.']];
    }
}
