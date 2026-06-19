export function validateEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[FATAL] Thiếu biến môi trường: ${missing.join(", ")}`);
    process.exit(1);
  }
}
