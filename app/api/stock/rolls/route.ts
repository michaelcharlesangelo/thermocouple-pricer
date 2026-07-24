import { NextRequest, NextResponse } from "next/server";
import { addRoll } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const type = body.type;
  const diameterMm = Number(body.diameterMm);
  const totalLengthM = Number(body.totalLengthM);

  if (!id) {
    return NextResponse.json({ error: "Serial number is required." }, { status: 400 });
  }
  if (!["S", "R", "B"].includes(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
    return NextResponse.json({ error: "Invalid diameter." }, { status: 400 });
  }
  if (!Number.isFinite(totalLengthM) || totalLengthM <= 0) {
    return NextResponse.json({ error: "Total length must be greater than 0." }, { status: 400 });
  }

  try {
    const stock = await addRoll({ id, type, diameterMm, totalLengthM });
    return NextResponse.json(stock);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
