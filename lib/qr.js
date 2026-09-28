// QR code generation (server-side). Returns a PNG data URL.
const QRCode = require('qrcode');

async function qrDataUrl(text) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: { dark: '#030164', light: '#ffffff' },
  });
}

module.exports = { qrDataUrl };
