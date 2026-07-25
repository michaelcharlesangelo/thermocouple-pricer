import { NextResponse } from "next/server";
import { getStock } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET() {
  const stock = await getStock();
  return NextResponse.json(stock);
}
