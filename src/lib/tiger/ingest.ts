import type { EventItem } from "@/lib/events/poller";
import { readSeedIds } from "@/lib/server/analysis";
import { personaIndex, toEventRow } from "./events";
import { tigerConfigured } from "./db";
import { insertEvents } from "./store";

let personas: Map<string, string> | null = null;

/**
 * Store a page of Nessie events in Tiger Data. Never throws: the live feed must keep working
 * if the database is slow or down, so failures are logged and the page is still served.
 */
export async function recordEvents(items: EventItem[]): Promise<void> {
  if (!items.length || !tigerConfigured()) return;
  personas ??= personaIndex(readSeedIds());
  try {
    await insertEvents(items.map((e) => toEventRow(e, personas!)));
  } catch (e) {
    console.warn("[tiger] could not store events", items[0]?.seq, "…", items[items.length - 1]?.seq, e instanceof Error ? e.message : e);
  }
}
