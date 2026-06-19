/**
 * Rate limit: 5 request / 60 giây / IP.
 * Production nên dùng Redis thay Map.
 */

// Map<ip, { count, resetAt }>
const ipWindows = new Map();

const MAX_REQUESTS = 5;
const WINDOW_MS = 60_000;

// Dọn IP hết hạn mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipWindows) {
    if (now > data.resetAt) ipWindows.delete(ip);
  }
}, 300_000);

export function rateLimiter(req, res, next) {
  // Lấy IP thật (Railway dùng reverse proxy)
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ??
    "unknown";

  const now = Date.now();
  const window = ipWindows.get(ip);

  if (!window || now > window.resetAt) {
    // Cửa sổ mới
    ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (window.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((window.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      message: "Bạn đang gửi yêu cầu quá nhanh. Vui lòng thử lại sau.",
      retryAfter,
    });
  }

  window.count += 1;
  next();
}
