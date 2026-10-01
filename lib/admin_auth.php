<?php
// Simple, reasonably secure admin auth: a shared secret (ADMIN_TOKEN) sent as a
// Bearer token over HTTPS, compared in constant time. Set ADMIN_TOKEN in env.

function timing_safe_eq(string $a, string $b): bool {
    return hash_equals($b, $a);
}

function extract_admin_token(): string {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.*)$/i', $auth, $m)) return trim($m[1]);
    return trim($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
}

function is_admin(): bool {
    $expected = env('ADMIN_TOKEN', '');
    if (!$expected) return false;
    return timing_safe_eq(extract_admin_token(), $expected);
}
