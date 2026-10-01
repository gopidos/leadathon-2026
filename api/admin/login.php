<?php
// POST /api/admin/login { token } -> validates the admin token.
require_once __DIR__ . '/../../lib/env.php';
load_env();
require_once __DIR__ . '/../../lib/admin_auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = [];
$token = (string) ($body['token'] ?? '');
$expected = env('ADMIN_TOKEN', '');

if ($expected && timing_safe_eq($token, $expected)) {
    http_response_code(200);
    echo json_encode(['ok' => true]);
} else {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Invalid admin token']);
}
