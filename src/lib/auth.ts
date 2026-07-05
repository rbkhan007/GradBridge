// GradBridge auth — wraps Neon Auth for backward-compatible API.
// External callers use requireUser() / getSessionUser() — they now delegate
// to the Neon Auth server SDK instead of custom HMAC+scrypt.

import { auth } from "./auth/server";
import type { SessionUser } from "./types";

export type { SessionUser } from "./types";

/** HTTP error carrying a status code, for use in route handlers. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Resolve the current authenticated user, or null. */
export async function getSessionUser(_req?: Request): Promise<SessionUser | null> {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return null;
    return { id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "" };
  } catch {
    return null;
  }
}

/** Require an authenticated user; throws HttpError(401) otherwise. */
export async function requireUser(_req?: Request): Promise<SessionUser> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) throw new HttpError(401, "Not authenticated");
  return sessionUser;
}
