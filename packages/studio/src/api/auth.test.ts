import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  authMiddleware,
  isAuthEnabled,
  registerAuthRoutes,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from "./auth.js";

const PASSWORD = "test-password-123";
const NOW = 1_800_000_000_000;

// 与 server.ts 相同的挂载方式：中间件在业务路由之前，认证端点由 registerAuthRoutes 提供。
function createTestApp() {
  const app = new Hono();
  app.use("/api/v1/*", authMiddleware);
  registerAuthRoutes(app);
  app.get("/api/v1/books", (c) => c.json({ books: [] }));
  return app;
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const pair = setCookie.split(";").find((part) => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  expect(pair, "login response should set the session cookie").toBeDefined();
  return pair!.trim();
}

describe("studio auth", () => {
  beforeEach(() => {
    vi.stubEnv("INKOS_STUDIO_PASSWORD", PASSWORD);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("token & password primitives", () => {
    it("sign/verify roundtrip succeeds", () => {
      const token = signSessionToken(NOW);
      expect(verifySessionToken(token, NOW)).toBe(true);
    });

    it("rejects an expired token", () => {
      const token = signSessionToken(NOW);
      expect(verifySessionToken(token, NOW + SESSION_TTL_MS + 1)).toBe(false);
    });

    it("rejects a tampered signature", () => {
      const token = signSessionToken(NOW);
      const [expiry, signature] = token.split(".");
      const tampered = `${expiry}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
      expect(verifySessionToken(tampered, NOW)).toBe(false);
    });

    it("rejects a tampered expiry", () => {
      const token = signSessionToken(NOW);
      const [, signature] = token.split(".");
      expect(verifySessionToken(`${NOW + 10 * SESSION_TTL_MS}.${signature}`, NOW)).toBe(false);
    });

    it("rejects malformed tokens", () => {
      expect(verifySessionToken("", NOW)).toBe(false);
      expect(verifySessionToken("no-dot-here", NOW)).toBe(false);
      expect(verifySessionToken("abc.def", NOW)).toBe(false);
    });

    it("accepts the correct password and rejects a wrong one", () => {
      expect(verifyPassword(PASSWORD)).toBe(true);
      expect(verifyPassword("wrong-password")).toBe(false);
    });
  });

  describe("auth disabled", () => {
    beforeEach(() => {
      vi.stubEnv("INKOS_STUDIO_PASSWORD", "");
    });

    it("isAuthEnabled() is false when the password env is unset/empty", () => {
      expect(isAuthEnabled()).toBe(false);
    });

    it("middleware lets business requests through without a cookie", async () => {
      const app = createTestApp();
      const res = await app.request("/api/v1/books");
      expect(res.status).toBe(200);
    });

    it("status reports authEnabled: false", async () => {
      const app = createTestApp();
      const res = await app.request("/api/v1/auth/status");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ authEnabled: false, authenticated: false });
    });
  });

  describe("auth enabled (integration)", () => {
    it("rejects business requests without a cookie", async () => {
      const app = createTestApp();
      const res = await app.request("/api/v1/books");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });

    it("rejects business requests with an invalid cookie", async () => {
      const app = createTestApp();
      const res = await app.request("/api/v1/books", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=forged.token` },
      });
      expect(res.status).toBe(401);
    });

    it("rejects login with a wrong password", async () => {
      const app = createTestApp();
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      });
      expect(res.status).toBe(401);
    });

    it("logs in with the correct password and serves business requests with the cookie", async () => {
      const app = createTestApp();
      const loginRes = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: PASSWORD }),
      });
      expect(loginRes.status).toBe(200);
      expect(await loginRes.json()).toEqual({ ok: true });
      const setCookie = loginRes.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Path=/");

      const cookie = extractSessionCookie(loginRes);
      const authedRes = await app.request("/api/v1/books", {
        headers: { Cookie: cookie },
      });
      expect(authedRes.status).toBe(200);
      expect(await authedRes.json()).toEqual({ books: [] });
    });

    it("status is public and reflects the session", async () => {
      const app = createTestApp();
      const anonymousRes = await app.request("/api/v1/auth/status");
      expect(anonymousRes.status).toBe(200);
      expect(await anonymousRes.json()).toEqual({ authEnabled: true, authenticated: false });

      const loginRes = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: PASSWORD }),
      });
      const authedRes = await app.request("/api/v1/auth/status", {
        headers: { Cookie: extractSessionCookie(loginRes) },
      });
      expect(authedRes.status).toBe(200);
      expect(await authedRes.json()).toEqual({ authEnabled: true, authenticated: true });
    });

    it("logout clears the cookie and subsequent requests are rejected", async () => {
      const app = createTestApp();
      const logoutRes = await app.request("/api/v1/auth/logout", { method: "POST" });
      expect(logoutRes.status).toBe(200);
      expect(await logoutRes.json()).toEqual({ ok: true });
      // deleteCookie 通过过期空值让浏览器丢弃 Cookie；服务端无状态，之后没有 Cookie 即 401。
      const setCookie = logoutRes.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
      expect(setCookie).toMatch(/Max-Age=0/i);

      const res = await app.request("/api/v1/books");
      expect(res.status).toBe(401);
    });
  });
});
