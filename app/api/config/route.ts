import { NextRequest, NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/store";
import { PricingConfig } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as PricingConfig;
  // Basic shape validation - keep it forgiving since this is an internal tool
  if (!body || typeof body !== "object" || !Array.isArray(body.stockPrices)) {
    return NextResponse.json({ error: "Invalid config shape" }, { status: 400 });
  }
  await setConfig(body);
  return NextResponse.json(body);
}
