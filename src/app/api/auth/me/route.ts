// GET /api/auth/me — returns the currently authenticated user, or 401.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email } as AuthUser,
    });
  } catch (err) {
    console.error("[auth/me] Error:", err);
    return NextResponse.json(
      { error: "Failed to check authentication" },
      { status: 500 },
    );
  }
}
