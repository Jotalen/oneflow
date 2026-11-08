import { connection, NextResponse } from "next/server";
import { tfsMeta } from "@/lib/server/tfs-meta";

export async function GET() {
  await connection();
  return NextResponse.json(tfsMeta(), { headers: { "cache-control": "public, max-age=3600" } });
}
