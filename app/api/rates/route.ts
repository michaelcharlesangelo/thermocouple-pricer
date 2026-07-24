import { NextRequest, NextResponse } from "next/server";
import { getRates, setRates } from "@/lib/store";
import { MarketRates } from "@/lib/pricing";

export async function GET() {
  const rates = await getRates();
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rates: MarketRates = {
    platinumUsdPerOz: Number(body.platinumUsdPerOz),
    rhodiumUsdPerOz: Number(body.rhodiumUsdPerOz),
    usdEurRate: Number(body.usdEurRate),
    usdIdrRate: Number(body.usdIdrRate),
    updatedAt: new Date().toISOString(),
    source: "manual",
  };
  if (
    !Number.isFinite(rates.platinumUsdPerOz) ||
    !Number.isFinite(rates.rhodiumUsdPerOz) ||
    !Number.isFinite(rates.usdEurRate) ||
    !Number.isFinite(rates.usdIdrRate)
  ) {
    return NextResponse.json({ error: "Invalid rate values" }, { status: 400 });
  }
  await setRates(rates);
  return NextResponse.json(rates);
}
