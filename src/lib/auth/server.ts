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

/** Lazy proxy — defers initialization until a property is first accessed. */
export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_, prop) {
    return (getAuth() as any)[prop];
  },
});
