import "dotenv/config";
import express from "express";
import { validateEnv } from "./utils/validateEnv.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { hmacAuth } from "./middleware/hmac.js";
import { replayGuard } from "./middleware/replay.js";
import aiRouter from "./routes/ai.js";

validateEnv(["AI_API_KEY", "AI_API_URL", "AI_MODEL", "INTERNAL_SECRET", "ALLOWED_VERCEL_ORIGIN"]);

const app = express();
app.disable("x-powered-by");

// Chỉ nhận JSON, giới hạn size để tránh payload bombing
app.use(express.json({ limit: "16kb" }));

// Chặn mọi request không đến từ Vercel
app.use((req, res, next) => {
  const origin = req.headers["origin"] ?? req.headers["x-forwarded-for"] ?? "";
  const vercelOrigin = process.env.ALLOWED_VERCEL_ORIGIN;

  // Railway không expose ra internet trực tiếp — nhưng nếu có,
  // kiểm tra header x-internal-caller do Vercel gắn vào
  const caller = req.headers["x-internal-caller"];
  if (caller !== "vercel-serverless") {
    return res.status(403).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }
  next();
});

// Áp dụng middleware theo thứ tự: rate limit → replay → hmac → route
app.use("/api/ai", rateLimiter, replayGuard, hmacAuth, aiRouter);

// Health check (internal)
app.get("/health", (_, res) => res.json({ ok: true }));

// 404
app.use((_, res) => res.status(404).json({ success: false, message: "Not found." }));

// Global error handler — KHÔNG leak stack trace ra client
app.use((err, req, res, _next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Railway server running on :${PORT}`));
