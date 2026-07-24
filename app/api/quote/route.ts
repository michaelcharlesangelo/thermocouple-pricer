import { NextRequest, NextResponse } from "next/server";
import { getRates, getConfig } from "@/lib/store";
import { calculateQuote, QuoteInput } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const input = (await req.json()) as QuoteInput;

  try {
    const [rates, config] = await Promise.all([getRates(), getConfig()]);
    const breakdown = calculateQuote(input, rates, config);
    return NextResponse.json({ breakdown, rates });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
