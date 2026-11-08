"use client";
import { useEventFeed } from "@/hooks/useEventFeed";
import { Card } from "./ui/Card";

const TYPE_STYLE: Record<string, string> = {
  "transaction.created": "text-warn",
  "transaction.pending": "text-warn",
  "transaction.completed": "text-good",
  "transaction.declined": "text-bad",
  "transaction.cancelled": "text-muted",
};

export function EventFeed({ hasKey }: { hasKey: boolean }) {
  const { events, live } = useEventFeed(hasKey);
  return (
    <Card eyebrow="Nessie event feed" title={hasKey ? "Live from the bank" : "Event feed (needs Nessie key)"} right={<span className={`chip ${live && hasKey ? "text-good" : "text-muted"}`}>{live && hasKey ? "● polling 2s" : "offline"}</span>}>
      {events.length === 0 ? (
        <p className="text-sm text-muted">No events yet. Accept a move to post a real transaction.</p>
      ) : (
        <ul className="text-xs font-mono space-y-1 max-h-48 overflow-auto">
          {events.slice(0, 12).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="text-muted">#{e.seq}</span>
              <span className={TYPE_STYLE[e.type] ?? ""}>{e.type}</span>
              {e.tx_id && <span className="text-muted truncate">{e.tx_id}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
