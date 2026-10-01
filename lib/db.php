<?php
// Minimal MySQL helper (PDO), server-side only.

function db_configured(): bool {
    return (bool) (env('DATABASE_URL') || (env('DB_HOST') && env('DB_USER') && env('DB_NAME')));
}

function db_pdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $url = env('DATABASE_URL');
    if ($url) {
        $parts = parse_url($url);
        $host = $parts['host'];
        $port = $parts['port'] ?? 3306;
        $name = ltrim($parts['path'] ?? '', '/');
        $user = $parts['user'] ?? '';
        $pass = $parts['pass'] ?? '';
    } else {
        $host = env('DB_HOST');
        $port = env('DB_PORT', 3306);
        $name = env('DB_NAME');
        $user = env('DB_USER');
        $pass = env('DB_PASSWORD');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function db_query(string $sql, array $params = []): array {
    $stmt = db_pdo()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

// Runs an INSERT/UPDATE/DELETE and returns the PDOStatement (for rowCount()).
function db_exec(string $sql, array $params = []): PDOStatement {
    $stmt = db_pdo()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

// Runs fn($pdo) inside a transaction.
function db_transaction(callable $fn) {
    $pdo = db_pdo();
    $pdo->beginTransaction();
    try {
        $result = $fn($pdo);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
