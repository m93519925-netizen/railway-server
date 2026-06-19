import { createHmac, timingSafeEqual } from "crypto";

/**
 * Xác thực HMAC-SHA256 của payload từ Vercel.
 * Vercel ký: HMAC_SHA256(payload_json, INTERNAL_SECRET)
 * Railway kiểm tra lại chữ ký.
 */
export function hmacAuth(req, res, next) {
  const { payload, timestamp, nonce, signature } = req.body;

  // Kiểm tra đủ trường
  if (!payload || !timestamp || !nonce || !signature) {
    return res.status(400).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }

  // Kiểm tra timestamp (±60 giây)
  const now = Date.now();
  const ts = Number(timestamp);
  if (Number.isNaN(ts) || Math.abs(now - ts) > 60_000) {
    return res.status(401).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }

  // Tái tạo chuỗi ký giống hệt Vercel đã ký
  const dataToSign = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;

  const expected = createHmac("sha256", process.env.INTERNAL_SECRET)
    .update(dataToSign)
    .digest("hex");

  let provided;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return res.status(401).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }

  const expectedBuf = Buffer.from(expected, "hex");

  // So sánh constant-time để tránh timing attack
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    return res.status(401).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }

  // Gắn payload đã xác thực vào request để route dùng
  req.verifiedPayload = payload;
  next();
}
