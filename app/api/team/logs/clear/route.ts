import { NextResponse } from "next/server";
import { clearTeamLogs } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  await clearTeamLogs();
  return NextResponse.json({ ok: true });
}
