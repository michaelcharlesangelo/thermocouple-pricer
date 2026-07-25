import { NextRequest, NextResponse } from "next/server";
import { setTeamPasswordHash } from "@/lib/store";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ ok: false, error: "New password must be at least 4 characters." }, { status: 400 });
  }

  await setTeamPasswordHash(hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
