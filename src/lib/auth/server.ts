import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookiesSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) {
  throw new Error(
    "NEON_AUTH_BASE_URL is not set. Set it in .env or Vercel env vars."
  );
}
if (!cookiesSecret || cookiesSecret.length < 32) {
  throw new Error(
    "NEON_AUTH_COOKIE_SECRET must be at least 32 characters. Set it in .env or Vercel env vars."
  );
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookiesSecret,
  },
  logLevel: "warn",
});
