const crypto = require('crypto');

function verifyTelegramWebAppData(telegramInitData, botToken) {
  if (!telegramInitData || !botToken) return null;

  try {
    const params = new URLSearchParams(telegramInitData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Urutkan key secara alfabetis sesuai spesifikasi resmi Telegram
    const dataCheckArr = [];
    for (const [key, value] of params.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort((a, b) => a.localeCompare(b));
    const dataCheckString = dataCheckArr.join('\n');

    // Buat secret key HMAC-SHA256 dengan konstanta "WebAppData"
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Timing-safe comparison untuk mencegah timing attack
    const hashBuf = Buffer.from(hash, 'hex');
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
      return null;
    }

    // Validasi freshness auth_date (maksimal 24 jam)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || nowSec - authDate > 86400) {
      return null;
    }

    const userRaw = params.get('user');
    return {
      user: userRaw ? JSON.parse(userRaw) : null,
      startParam: params.get('start_param') || ''
    };
  } catch (err) {
    return null;
  }
}

module.exports = { verifyTelegramWebAppData };
