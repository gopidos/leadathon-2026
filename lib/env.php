<?php
// Tiny .env loader for LOCAL dev only (no dependency).
// On real hosting, env vars are set via the host's control panel / php-fpm pool,
// so this is never needed there.
function load_env(): void {
    $file = __DIR__ . '/../.env.local';
    if (!file_exists($file)) return;
    foreach (file($file) as $line) {
        if (!preg_match('/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i', $line, $m)) continue;
        $val = trim($m[2]);
        if ((str_starts_with($val, '"') && str_ends_with($val, '"')) ||
            (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
            $val = substr($val, 1, -1);
        }
        if (getenv($m[1]) === false) {
            putenv($m[1] . '=' . $val);
            $_ENV[$m[1]] = $val;
        }
    }
}

function env(string $key, $default = null) {
    $v = getenv($key);
    return $v === false ? $default : $v;
}
