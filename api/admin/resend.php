<?php
// POST /api/admin/resend { participantId } -> re-send the QR pass email. (admin only)
require_once __DIR__ . '/../../lib/env.php';
load_env();
require_once __DIR__ . '/../../lib/admin_auth.php';
require_once __DIR__ . '/../../lib/db.php';
require_once __DIR__ . '/../../lib/qr.php';
require_once __DIR__ . '/../../lib/email.php';

header('Content-Type: application/json');

if (!is_admin()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = [];
$id = $body['participantId'] ?? null;
if (!$id) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'participantId required']);
    exit;
}

try {
    $rows = db_query(
        'SELECT participants.*,
                registrations.team_name     AS reg_team_name,
                registrations.problem_title AS reg_problem_title,
                registrations.problem_code  AS reg_problem_code
           FROM participants
           JOIN registrations ON registrations.id = participants.registration_id
          WHERE participants.id = ?',
        [$id]
    );
    if (!count($rows)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Participant not found']);
        exit;
    }
    $p = $rows[0];
    $url = env('PUBLIC_BASE_URL', '') . '/verify?t=' . $p['qr_token'];
    $dataUrl = qr_data_url($url);
    $result = send_qr_email($p['email'], $p['name'], $p['reg_team_name'], $p['reg_problem_title'], $p['reg_problem_code'], $dataUrl);

    if (!$result['sent']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Email not sent: ' . ($result['reason'] ?? 'unknown')]);
        exit;
    }
    try { db_exec('UPDATE participants SET email_sent_at = ? WHERE id = ?', [date('Y-m-d H:i:s'), $p['id']]); } catch (Throwable $e) {}
    http_response_code(200);
    echo json_encode(['ok' => true, 'id' => $result['id']]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
