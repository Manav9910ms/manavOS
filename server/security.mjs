const buckets = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 60;

export function rateLimit(key, limit = LIMIT, windowMs = WINDOW_MS) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: Math.max(0, limit - 1) };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.ceil((windowMs - (now - current.startedAt)) / 1000) };
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = String(req.headers.host || "").split(":")[0];
    return url.hostname === host;
  } catch { return false; }
}

export function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

export function audit(db, { userId = null, action, ip = null, userAgent = null, metadata = null }) {
  db.prepare("INSERT INTO audit_events (user_id,action,ip,user_agent,metadata_json,created_at) VALUES (?,?,?,?,?,?)")
    .run(userId, action, ip, userAgent, metadata ? JSON.stringify(metadata) : null, Date.now());
}
