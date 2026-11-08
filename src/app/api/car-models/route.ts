import { connection, NextResponse } from "next/server";
import { loadToyota } from "@/lib/toyota/load";
import { carCatalog } from "@/lib/bank/borrowing";

/** New Toyota models and prices from the TFS hackathon data pack, for the Shop & finance car picker. */
export async function GET() {
  await connection();
  try {
    return NextResponse.json({ cars: carCatalog(loadToyota().vehicles) }, { headers: { "cache-control": "public, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ cars: [], error: e instanceof Error ? e.message : "car list unavailable" }, { status: 500 });
  }
}
