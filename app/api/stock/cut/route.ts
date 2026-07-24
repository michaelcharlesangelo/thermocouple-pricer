import { NextRequest, NextResponse } from "next/server";
import { recordCut } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rollId = typeof body.rollId === "string" ? body.rollId : "";
  const cutLengthM = Number(body.cutLengthM);
  const jobOrder = typeof body.jobOrder === "string" ? body.jobOrder.trim() : "";

  if (!rollId) {
    return NextResponse.json({ error: "Roll is required." }, { status: 400 });
  }
  if (!Number.isFinite(cutLengthM) || cutLengthM <= 0) {
    return NextResponse.json({ error: "Cut length must be greater than 0." }, { status: 400 });
  }
  if (!jobOrder) {
    return NextResponse.json({ error: "Job order / description is required." }, { status: 400 });
  }

  try {
    const stock = await recordCut(rollId, cutLengthM, jobOrder);
    return NextResponse.json(stock);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
