import { NextRequest, NextResponse } from "next/server";
import { deleteRoll } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(req: NextRequest) {
  const body = await req.json();
  const rollId = typeof body.rollId === "string" ? body.rollId : "";
  if (!rollId) {
    return NextResponse.json({ error: "Roll is required." }, { status: 400 });
  }
  const stock = await deleteRoll(rollId);
  return NextResponse.json(stock);
}
