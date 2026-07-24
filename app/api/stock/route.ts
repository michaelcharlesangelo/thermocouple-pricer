import { NextResponse } from "next/server";
import { getStock } from "@/lib/store";

export async function GET() {
  const stock = await getStock();
  return NextResponse.json(stock);
}
