import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordHash } from "@/lib/store";
import { verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = typeof body.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ ok: false, error: "Password required." }, { status: 400 });
  }

  // The ADMIN_PASSWORD env var (set in Vercel) always works as a recovery
  // fallback, regardless of whatever's been set via the Security tab.
  const masterPassword = process.env.ADMIN_PASSWORD;
  if (masterPassword && password === masterPassword) {
    return NextResponse.json({ ok: true });
  }

  const storedHash = await getAdminPasswordHash();
  if (storedHash && verifyPassword(password, storedHash)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
}
