<?php
// QR code generation (server-side). Returns a PNG data URL.
require_once __DIR__ . '/../vendor/autoload.php';

use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use chillerlan\QRCode\Common\EccLevel;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\Output\QRGdImagePNG;

function qr_data_url(string $text): string {
    $darkColor = [3, 1, 100]; // #030164

    $moduleValues = [];
    foreach (QROutputInterface::DEFAULT_MODULE_VALUES as $type => $isDark) {
        $moduleValues[$type] = $isDark ? $darkColor : [255, 255, 255];
    }

    $options = new QROptions([
        'outputInterface' => QRGdImagePNG::class,
        'eccLevel' => EccLevel::M,
        'scale' => 10,
        'quietzoneSize' => 1,
        'bgColor' => [255, 255, 255],
        'moduleValues' => $moduleValues,
        'outputBase64' => true,
    ]);

    return (new QRCode($options))->render($text);
}
