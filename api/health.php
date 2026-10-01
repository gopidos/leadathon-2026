<?php
// GET /api/health — reports which env vars are configured (names only, no secret
// values) and the effective storage mode. Safe to expose; helps verify deploys.
require_once __DIR__ . '/../lib/env.php';
load_env();

header('Content-Type: application/json');

$has = fn(string $k) => env($k) !== null && env($k) !== false && env($k) !== '';
$dbConfigured = $has('DATABASE_URL') || ($has('DB_HOST') && $has('DB_USER') && $has('DB_NAME'));

echo json_encode([
    'ok' => true,
    'env' => [
        'DB_HOST' => $has('DB_HOST'),
        'DB_NAME' => $has('DB_NAME'),
        'DB_USER' => $has('DB_USER'),
        'DATABASE_URL' => $has('DATABASE_URL'),
        'RESEND_API_KEY' => $has('RESEND_API_KEY'),
        'RESEND_FROM' => $has('RESEND_FROM'),
        'ADMIN_TOKEN' => $has('ADMIN_TOKEN'),
        'PUBLIC_BASE_URL' => env('PUBLIC_BASE_URL') ?: null,
    ],
    'storage' => $dbConfigured ? 'mysql' : 'local',
    'time' => date('c'),
]);
