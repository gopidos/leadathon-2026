<?php
// POST /api/register
// Reads MySQL credentials from environment variables: DB_HOST, DB_PORT, DB_NAME,
// DB_USER, DB_PASSWORD (or a single DATABASE_URL).

require_once __DIR__ . '/../lib/env.php';
load_env();
require_once __DIR__ . '/../lib/register_core.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) $body = [];

$result = handle_registration($body);
http_response_code($result['status']);
echo json_encode($result['body']);
