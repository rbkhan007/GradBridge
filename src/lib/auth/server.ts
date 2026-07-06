import { NextRequest, NextResponse } from "next/server";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

let _auth: ReturnType<typeof createNeonAuth> | null = null;

/** In-memory credential + session store for local auth fallback. */
const _passwords = new Map<string, string>(); // email → "hash:salt"
const _sessions = new Map<string, string>();   // token → userId

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

const SESSION_COOKIE = "gradbridge_session";

function jsonUser(u: { id: string; email: string; name: string; role?: string | null }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role ?? "user" };
}

async function sessionUser(token: string) {
  const userId = _sessions.get(token);
  if (!userId) return null;
  const user = await (db as any).user.findUnique({ where: { id: userId } });
  return user ? jsonUser(user) : null;
}

/** Simulated auth for local dev / CI when NEON_AUTH_BASE_URL is not set. */
function createLocalAuth() {
  return {
    handler: () => ({
      GET: async (req: NextRequest) => {
        const token = req.cookies.get(SESSION_COOKIE)?.value;
        const user = token ? await sessionUser(token) : null;
        return NextResponse.json({ user });
      },
      POST: async (req: NextRequest) => {
        const action = new URL(req.url).pathname.split("/").pop();
        if (action === "sign-in" || action === "email") {
          const { email, password } = await req.json();
          if (!email || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 401 });
          const stored = _passwords.get(email);
          if (!stored) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
          const [hash, salt] = stored.split(":");
          if (hashPassword(password, salt) !== hash) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
          const user = await (db as any).user.findUnique({ where: { email } });
          if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });
          const token = generateToken();
          _sessions.set(token, user.id);
          const res = NextResponse.json({ token, user: jsonUser(user), session: { id: token } });
          res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 604800 });
          return res;
        }
        if (action === "sign-out") {
          const token = req.cookies.get(SESSION_COOKIE)?.value;
          if (token) _sessions.delete(token);
          const res = NextResponse.json({ ok: true });
          res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
          return res;
        }
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      },
      PUT: async () => NextResponse.json({ error: "Not found" }, { status: 404 }),
      DELETE: async () => NextResponse.json({ error: "Not found" }, { status: 404 }),
      PATCH: async () => NextResponse.json({ error: "Not found" }, { status: 404 }),
    }),
    signUp: {
      email: async (body: { name: string; email: string; password: string; options?: any }) => {
        const id = generateToken();
        const salt = randomBytes(16).toString("hex");
        _passwords.set(body.email, `${hashPassword(body.password, salt)}:${salt}`);
        // Don't create user here — the caller (register route) handles DB insertion.
        // Just return the generated ID so the caller can use it.
        return { data: { user: { id, email: body.email, name: body.name } }, error: null };
      },
    },
    getSession: async () => ({ data: null, error: null }),
    getUser: async () => ({ data: null, error: null }),
    signOut: async () => ({ data: null, error: null }),
  };
}

export function getAuth() {
  if (!_auth) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const cookiesSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (baseUrl && cookiesSecret && cookiesSecret.length >= 32) {
      _auth = createNeonAuth({ baseUrl, cookies: { secret: cookiesSecret }, logLevel: "warn" });
    }
    // If env vars not set, return null — the proxy will use local fallback.
    return null;
  }
  return _auth;
}

/** Auth proxy with local fallback.
 *  - When NEON_AUTH_BASE_URL is set → uses real Neon Auth.
 *  - When not set (local dev / CI) → uses local DB + cookie-based session. */
export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_, prop) {
    const real = getAuth();
    if (real) return (real as any)[prop];
    const local = createLocalAuth();
    return (local as any)[prop];
  },
});
