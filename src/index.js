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
app.use(express.json({ limit: "16kb" }));

// ✅ Health check TRƯỚC middleware chặn
app.get("/health", (_, res) => res.json({ ok: true }));

// Chặn request không từ Vercel
app.use((req, res, next) => {
  const caller = req.headers["x-internal-caller"];
  if (caller !== "vercel-serverless") {
    return res.status(403).json({
      success: false,
      message: "Tính năng AI chỉ khả dụng từ website chính thức.",
    });
  }
  next();
});

app.use("/api/ai", rateLimiter, replayGuard, hmacAuth, aiRouter);

app.use((_, res) => res.status(404).json({ success: false, message: "Not found." }));

app.use((err, req, res, _next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Railway server running on :${PORT}`));
