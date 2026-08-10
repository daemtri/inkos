// Studio 简单登录鉴权：单密码模型（INKOS_STUDIO_PASSWORD），未设置则完全不启用。
// 会话凭证是无状态签名令牌 `<expiryUnixMs>.<base64url(hmac)>`，HMAC-SHA256，
// 密钥由密码派生（sha256(password)），有效期 7 天，服务端零存储、重启不掉线。
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Hono, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SESSION_COOKIE_NAME = "inkos_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isAuthEnabled(): boolean {
  return Boolean(process.env.INKOS_STUDIO_PASSWORD?.trim());
}

function sessionKey(): Buffer {
  return createHash("sha256").update(process.env.INKOS_STUDIO_PASSWORD ?? "", "utf8").digest();
}

export function verifyPassword(candidate: string): boolean {
  if (!isAuthEnabled()) return false;
  // 比较双方的 sha256 摘要而非原文：timingSafeEqual 要求等长输入，
  // 摘要定长后不同长度的候选密码也能做常数时间比较。
  const expected = sessionKey();
  const actual = createHash("sha256").update(candidate, "utf8").digest();
  return timingSafeEqual(expected, actual);
}

export function signSessionToken(now: number = Date.now()): string {
  const expiry = now + SESSION_TTL_MS;
  const hmac = createHmac("sha256", sessionKey()).update(String(expiry), "utf8").digest("base64url");
  return `${expiry}.${hmac}`;
}

export function verifySessionToken(token: string, now: number = Date.now()): boolean {
  if (!isAuthEnabled()) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiryRaw = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expiry = Number(expiryRaw);
  if (!Number.isSafeInteger(expiry) || expiry <= now) return false;
  // 对原始过期时间字符串（而非归一化后的数字）重算 HMAC，防止 "007" 之类的变体通过。
  const expected = createHmac("sha256", sessionKey()).update(expiryRaw, "utf8").digest("base64url");
  const receivedBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf);
}

// 挂在 /api/v1/* 上、业务路由之前；/api/v1/auth/* 自身放行（登录/状态端点必须公开）。
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  if (!isAuthEnabled()) return next();
  if (c.req.path.startsWith("/api/v1/auth/")) return next();
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token && verifySessionToken(token)) return next();
  return c.json({ error: "unauthorized" }, 401);
}

export function registerAuthRoutes(app: Hono): void {
  app.post("/api/v1/auth/login", async (c) => {
    const body = await c.req.json<{ password?: unknown }>().catch(() => ({}) as { password?: unknown });
    const password = typeof body.password === "string" ? body.password : "";
    if (!isAuthEnabled() || !verifyPassword(password)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    // 不加 Secure 以兼容内网 HTTP 部署；公网应套 HTTPS（见 spec 已知限制）。
    setCookie(c, SESSION_COOKIE_NAME, signSessionToken(), {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return c.json({ ok: true });
  });

  app.post("/api/v1/auth/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/v1/auth/status", (c) => {
    const authEnabled = isAuthEnabled();
    const token = getCookie(c, SESSION_COOKIE_NAME);
    const authenticated = authEnabled && Boolean(token && verifySessionToken(token));
    return c.json({ authEnabled, authenticated });
  });
}
