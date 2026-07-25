import { NextResponse } from "next/server";
import { getRates } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET() {
  const rates = await getRates();
  return NextResponse.json(rates);
}
