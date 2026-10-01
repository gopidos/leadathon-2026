<?php
// GET /api/admin/registrations -> all teams with participants + stats. (admin only)
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

try {
    $regs = db_query('SELECT * FROM registrations ORDER BY created_at DESC');
    $parts = db_query('SELECT * FROM participants ORDER BY idx ASC');

    $byReg = [];
    foreach ($parts as $p) {
        $byReg[$p['registration_id']][] = $p;
    }

    $data = array_map(function ($r) use ($byReg) {
        $r['participants'] = $byReg[$r['id']] ?? [];
        return $r;
    }, $regs);

    $stats = [
        'teams' => count($data),
        'participants' => count($parts),
        'checkedIn' => count(array_filter($parts, fn($p) => $p['status'] === 'checked_in')),
        'checkedOut' => count(array_filter($parts, fn($p) => $p['status'] === 'checked_out')),
        'registered' => count(array_filter($parts, fn($p) => $p['status'] === 'registered')),
    ];

    http_response_code(200);
    echo json_encode(['ok' => true, 'registrations' => $data, 'stats' => $stats]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
