import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const deleted = await db.conversation.deleteMany({
      where: { userId: user.id },
    });
    return NextResponse.json({
      success: true,
      deleted: deleted.count,
    });
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to clear chats" }, { status: 500 });
  }
}
