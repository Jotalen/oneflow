import { connection, NextResponse } from "next/server";
import { loadToyota } from "@/lib/toyota/load";

/** Toyota Financial Services hackathon rate sheet (static CSV in the data pack). */
export async function GET() {
  await connection();
  try {
    return NextResponse.json({ rates: loadToyota().rates }, { headers: { "cache-control": "public, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ rates: [], error: e instanceof Error ? e.message : "rate sheet unavailable" }, { status: 500 });
  }
}
