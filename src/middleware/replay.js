/**
 * Chống replay attack bằng cách lưu nonce vào Map trong memory.
 * Với quy mô lớn hơn, thay bằng Redis với TTL.
 */

// Map<nonce, expiresAt (ms)>
const usedNonces = new Map();

// Dọn nonce hết hạn mỗi 2 phút để tránh memory leak
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of usedNonces) {
    if (now > expiresAt) usedNonces.delete(nonce);
  }
}, 120_000);

export function replayGuard(req, res, next) {
  const { nonce, timestamp } = req.body;

  if (!nonce || typeof nonce !== "string" || nonce.length < 8 || nonce.length > 64) {
    return res.status(400).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }

  if (usedNonces.has(nonce)) {
    return res.status(401).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }

  // Lưu nonce, tự hết hạn sau 90 giây (dư 30s so với window 60s)
  usedNonces.set(nonce, Date.now() + 90_000);
  next();
}
