import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

// Danh sách model được phép, tránh bị dùng để gọi model đắt tùy ý
const ALLOWED_MODELS = new Set([
  process.env.AI_MODEL, // model mặc định từ env
]);

router.post("/", async (req, res) => {
  const payload = req.verifiedPayload; // đã được hmacAuth xác thực

  const { messages, max_tokens } = payload;

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  // Giới hạn số lượng message và độ dài
  if (messages.length > 10) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  for (const msg of messages) {
    if (typeof msg.role !== "string" || typeof msg.content !== "string") {
      return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
    }
    if (msg.content.length > 4000) {
      return res.status(400).json({ success: false, message: "Nội dung quá dài." });
    }
  }

  const safeMaxTokens = Math.min(Number(max_tokens) || 500, 800);

  try {
    const aiRes = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages,
        max_tokens: safeMaxTokens,
        stream: true,
      }),
      // Timeout 30 giây
      signal: AbortSignal.timeout(30_000),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[AI Provider Error]", aiRes.status, errText);
      return res.status(502).json({ success: false, message: "AI tạm thời không khả dụng." });
    }

    // Pipe stream từ AI Provider về Vercel
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    aiRes.body.pipe(res);

    aiRes.body.on("error", (err) => {
      console.error("[Stream Error]", err);
      if (!res.headersSent) {
        res.status(502).json({ success: false, message: "Lỗi kết nối đến AI." });
      } else {
        res.end();
      }
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({ success: false, message: "AI phản hồi quá chậm." });
    }
    throw err; // để global error handler xử lý
  }
});

export default router;
