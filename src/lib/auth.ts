import { NextResponse } from "next/server";
import { auth as neonAuth } from "@/lib/auth/server";
import type { SessionUser } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type { SessionUser };

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  try {
    const { data } = await neonAuth.getSession();
    if (!data?.user) return null;
    return {
      id: data.user.id,
      name: data.user.name ?? "",
      email: data.user.email ?? "",
      role: (data.user as any).role ?? "user",
    };
  } catch {
    return null;
  }
}

export async function requireUser(req: Request): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return user;
}
