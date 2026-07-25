import { NextResponse } from "next/server";
import { getTeamLogs } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const logs = await getTeamLogs();
  return NextResponse.json(logs);
}
