import { connection, NextResponse } from "next/server";
import { NessieError } from "@/lib/nessie/client";
import { nessieApi } from "@/lib/nessie/api";
import { createEventCache } from "@/lib/events/cache";

const UPSTREAM_INTERVAL_MS = 2_000;
const UPSTREAM_PAGE = 500;

/** One shared upstream poller for every browser tab (see src/lib/events/cache.ts). */
const cache = createEventCache({
  fetchPage: (after, limit) => nessieApi().listEvents({ after, limit }),
  minIntervalMs: UPSTREAM_INTERVAL_MS,
  pageSize: UPSTREAM_PAGE,
});

export async function GET(req: Request) {
  await connection();
  if (!process.env.NESSIE_API_KEY) return NextResponse.json({ items: [], next_cursor: 0, offline: true });
  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? 0);
  const types = url.searchParams.get("types")?.split(",").filter(Boolean);
  try {
    return NextResponse.json(await cache.get(Number.isFinite(after) && after > 0 ? after : 0, types));
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message, retryAfter: e.retryAfter }, { status: e.status === 429 ? 429 : 503 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
