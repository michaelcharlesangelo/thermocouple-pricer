import { NextRequest, NextResponse } from "next/server";
import { getTeamPasswordHash, appendTeamLog } from "@/lib/store";
import { verifyPassword, DEFAULT_TEAM_PASSWORD } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, error: "Password required." }, { status: 400 });
  }

  const storedHash = await getTeamPasswordHash();
  const valid = storedHash ? verifyPassword(password, storedHash) : password === DEFAULT_TEAM_PASSWORD;

  if (!valid) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  await appendTeamLog(name);
  return NextResponse.json({ ok: true });
}
