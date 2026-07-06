import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import type { SessionUser, UserRole } from "@/lib/types";

export type { UserRole };

export async function authorize(
  req: Request,
  ...allowedRoles: UserRole[]
): Promise<SessionUser | NextResponse> {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as UserRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return user;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}

export function isModOrAdmin(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "moderator";
}

export function canManageWebhooks(user: SessionUser): boolean {
  return isAdmin(user);
}
