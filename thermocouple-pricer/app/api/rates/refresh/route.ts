import { NextResponse } from "next/server";
import { getRates, setRates } from "@/lib/store";
import { fetchLiveRates, mergeIntoRates } from "@/lib/fetchRates";

export async function POST() {
  const previous = await getRates();
  const fetched = await fetchLiveRates();
  const merged = mergeIntoRates(previous, fetched);
  await setRates(merged);
  return NextResponse.json({ rates: merged, warnings: fetched.errors });
}
