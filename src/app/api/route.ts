import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "GradBridge",
    version: "0.2.0",
    status: "ok",
    docs: "https://github.com/gradbridge/gradbridge#api-reference",
  });
}
