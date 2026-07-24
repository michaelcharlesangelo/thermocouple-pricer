import { NextRequest, NextResponse } from "next/server";
import { setFxRates } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const usdEurRate = Number(body.usdEurRate);
  const usdIdrRate = Number(body.usdIdrRate);

  if (!Number.isFinite(usdEurRate) || !Number.isFinite(usdIdrRate)) {
    return NextResponse.json({ error: "Invalid FX rate values" }, { status: 400 });
  }

  const rates = await setFxRates(usdEurRate, usdIdrRate, "manual");
  return NextResponse.json(rates);
}
