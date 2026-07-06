import { createNeonAuth } from "@neondatabase/auth/next/server";

let _auth: ReturnType<typeof createNeonAuth> | null = null;

export function getAuth() {
  if (!_auth) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const cookiesSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl) {
      throw new Error("NEON_AUTH_BASE_URL is not set. Set it in .env or Vercel env vars.");
    }
    if (!cookiesSecret || cookiesSecret.length < 32) {
      throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters. Set it in .env or Vercel env vars.");
    }
    _auth = createNeonAuth({ baseUrl, cookies: { secret: cookiesSecret }, logLevel: "warn" });
  }
  return _auth;
}

const noopHandler = async () => new Response(null, { status: 503 });
const handlerResult = { GET: noopHandler, POST: noopHandler, PUT: noopHandler, DELETE: noopHandler, PATCH: noopHandler };

/** Lazy proxy — defers auth initialization until a property is first accessed.
 *  During `next build` (CI), env vars may not be set, so we return no-op stubs
 *  to allow module-level evaluation (e.g. `auth.handler()`) without crashing.
 *  At runtime the server has env vars and works normally. */
export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_, prop) {
    try {
      return (getAuth() as any)[prop];
    } catch {
      if (prop === "handler") return () => handlerResult;
      if (prop === "signUp") return { email: async () => ({ data: null, error: new Error("Auth not configured") }) };
      return async () => ({ data: null, error: new Error("Auth not configured") });
    }
  },
});
