import { NextResponse } from "next/server";
import { getRates, setRates } from "@/lib/store";
import { fetchLiveFx, mergeFxIntoRates } from "@/lib/fetchRates";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST() {
  const previous = await getRates();
  const fx = await fetchLiveFx();
  const merged = mergeFxIntoRates(previous, fx);
  await setRates(merged);
  return NextResponse.json({ rates: merged, warnings: fx.error ? [fx.error] : [] });
}
