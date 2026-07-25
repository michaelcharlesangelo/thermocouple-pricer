import { NextRequest, NextResponse } from "next/server";
import { getAdminPasswordHash, setAdminPasswordHash } from "@/lib/store";
import { hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ ok: false, error: "New password must be at least 4 characters." }, { status: 400 });
  }

  const masterPassword = process.env.ADMIN_PASSWORD;
  const storedHash = await getAdminPasswordHash();

  const currentValid =
    Boolean(masterPassword && currentPassword === masterPassword) ||
    Boolean(storedHash && verifyPassword(currentPassword, storedHash));

  if (!currentValid) {
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
  }

  await setAdminPasswordHash(hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
