import { NextResponse } from "next/server";
import { getStock } from "@/lib/store";
import { summarizeStock } from "@/lib/stock";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET() {
  const stock = await getStock();
  return NextResponse.json({ summary: summarizeStock(stock.rolls) });
}
