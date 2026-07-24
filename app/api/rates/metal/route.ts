import { NextRequest, NextResponse } from "next/server";
import { setMetalRates } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const platinumUsdPerOz = Number(body.platinumUsdPerOz);
  const rhodiumUsdPerOz = Number(body.rhodiumUsdPerOz);

  if (!Number.isFinite(platinumUsdPerOz) || !Number.isFinite(rhodiumUsdPerOz)) {
    return NextResponse.json({ error: "Invalid metal price values" }, { status: 400 });
  }

  const rates = await setMetalRates(platinumUsdPerOz, rhodiumUsdPerOz);
  return NextResponse.json(rates);
}
