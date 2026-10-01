<?php
// POST /api/admin/checkin { participantId? , token? , action: 'in'|'out'|'reset' } (admin only)
require_once __DIR__ . '/../../lib/env.php';
load_env();
require_once __DIR__ . '/../../lib/admin_auth.php';
require_once __DIR__ . '/../../lib/db.php';

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

// Accept a raw token or a full verify URL containing ?t=<token>
function checkin_normalize_token(?string $t): string {
    if (!$t) return '';
    $s = trim($t);
    if (preg_match('/[?&]t=([^&\s]+)/', $s, $m)) return urldecode($m[1]);
    return $s;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = [];
$participantId = $body['participantId'] ?? null;
$action = $body['action'] ?? null;
$token = checkin_normalize_token($body['token'] ?? null);

if (!in_array($action, ['in', 'out', 'reset'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid action']);
    exit;
}

if ($participantId) { $whereCol = 'id'; $whereVal = $participantId; }
elseif ($token) { $whereCol = 'qr_token'; $whereVal = $token; }
else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'participantId or token required']);
    exit;
}

$now = date('Y-m-d H:i:s');
if ($action === 'in') { $setSql = 'status = ?, checked_in_at = ?'; $setParams = ['checked_in', $now]; }
elseif ($action === 'out') { $setSql = 'status = ?, checked_out_at = ?'; $setParams = ['checked_out', $now]; }
else { $setSql = 'status = ?, checked_in_at = NULL, checked_out_at = NULL'; $setParams = ['registered']; }

try {
    // Note: rowCount() reflects *changed* rows (MySQL default), not *matched* rows,
    // so a repeated no-op action (e.g. "reset" twice) would wrongly look like "not
    // found" if checked here. Existence is determined solely by the SELECT below.
    db_exec("UPDATE participants SET {$setSql} WHERE {$whereCol} = ?", [...$setParams, $whereVal]);
    $rows = db_query("SELECT * FROM participants WHERE {$whereCol} = ?", [$whereVal]);
    if (!count($rows)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Participant not found']);
        exit;
    }
    http_response_code(200);
    echo json_encode(['ok' => true, 'participant' => $rows[0]]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
