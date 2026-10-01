<?php
// Send a participant their secure QR pass via Resend's HTTP API.

function qr_escape_html(?string $s): string {
    return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8');
}

function qr_pass_html(string $participantName, string $teamName, ?string $problem, ?string $code): string {
    $name = qr_escape_html($participantName);
    $team = qr_escape_html($teamName);
    $prob = qr_escape_html($problem);
    $c = qr_escape_html($code);
    return <<<HTML
<!DOCTYPE html><html><body style="margin:0;background:#f4f2ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0c0d2b">
    <div style="max-width:520px;margin:0 auto;padding:28px 20px">
      <div style="background:#030164;border-radius:16px 16px 0 0;padding:26px 28px;color:#fff">
        <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#FFD758;font-weight:700">LEADATHON 2026</div>
        <div style="font-size:22px;font-weight:700;margin-top:6px">Your Event QR Pass</div>
      </div>
      <div style="background:#fff;border:1px solid #e7e4dc;border-top:none;border-radius:0 0 16px 16px;padding:28px">
        <p style="margin:0 0 4px">Hi <strong>{$name}</strong>,</p>
        <p style="margin:0 0 18px;color:#5b5f7d">You're registered for LEADATHON 2026 with team <strong>{$team}</strong>. This QR pass is unique to you — please keep it private and bring it to the venue for check-in.</p>
        <div style="text-align:center;padding:18px;background:#f7f8fc;border:1px solid #eceaf3;border-radius:14px">
          <img src="cid:qrpass" alt="Your QR pass" width="240" height="240" style="display:block;margin:0 auto;border-radius:8px" />
          <div style="margin-top:12px;font-size:13px;color:#5b5f7d">Scan at the LEADATHON check-in desk</div>
        </div>
        <table style="width:100%;margin-top:20px;font-size:14px;border-collapse:collapse">
          <tr><td style="color:#5b5f7d;padding:5px 0">Team</td><td style="text-align:right;font-weight:600">{$team}</td></tr>
          <tr><td style="color:#5b5f7d;padding:5px 0">Problem</td><td style="text-align:right;font-weight:600">{$c} {$prob}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#9498b5">This pass is personal and non-transferable. If you didn't register for LEADATHON 2026, please ignore this email.</p>
      </div>
      <div style="text-align:center;color:#9498b5;font-size:12px;margin-top:16px">We The Leaders Foundation · Manapparai, Tamil Nadu</div>
    </div></body></html>
HTML;
}

// qrDataUrl = "data:image/png;base64,...."
// Returns ['sent' => bool, 'id' => ?string, 'reason' => ?string]
function send_qr_email(string $to, string $participantName, string $teamName, ?string $problem, ?string $code, string $qrDataUrl): array {
    $key = env('RESEND_API_KEY');
    if (!$key) return ['sent' => false, 'reason' => 'no_resend_key'];
    $from = env('RESEND_FROM', 'LEADATHON 2026 <onboarding@resend.dev>');
    $base64 = explode(',', $qrDataUrl, 2)[1] ?? '';

    $payload = [
        'from' => $from,
        'to' => $to,
        'subject' => "Your LEADATHON 2026 QR Pass — {$teamName}",
        'html' => qr_pass_html($participantName, $teamName, $problem, $code),
        'attachments' => [[
            'filename' => 'leadathon-qr-pass.png',
            'content' => $base64,
            'content_id' => 'qrpass',
        ]],
    ];

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($body === false) return ['sent' => false, 'reason' => $err ?: 'request_failed'];

    $data = json_decode($body, true) ?: [];
    if ($status >= 200 && $status < 300) {
        return ['sent' => true, 'id' => $data['id'] ?? null];
    }
    $reason = $data['message'] ?? ($data['error']['message'] ?? 'resend_error');
    return ['sent' => false, 'reason' => $reason];
}
