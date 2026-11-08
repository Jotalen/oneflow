import { connection, NextResponse } from "next/server";
import { tfsPortfolio } from "@/lib/server/tfs-portfolio";

/** TFS portfolio across all 20 pack customers: data pack + engine, no live Nessie calls. */
export async function GET() {
  await connection();
  try {
    return NextResponse.json(tfsPortfolio(), { headers: { "cache-control": "public, max-age=300" } });
  } catch (e) {
    console.error("[tfs-portfolio] failed", e);
    return NextResponse.json({ error: "Portfolio unavailable" }, { status: 500 });
  }
}
