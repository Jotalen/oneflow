import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createNessieClient, NessieError } from "@/lib/nessie/client";
import { makeApi } from "@/lib/nessie/api";

type Call = { url: string; init: RequestInit };

function fakeFetch(responder: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return responder(call, calls.length);
  });
  return { fn, calls };
}

const ok = (body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...extra } });

describe("nessie client", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("adds bearer header and never puts key in URL", async () => {
    const f = fakeFetch(() => ok({ status: "healthy" }));
    const c = createNessieClient({ apiKey: "nsk_secret", baseUrl: "https://x.test", fetchImpl: f.fn });
    await c.fetch("/health");
    expect(f.calls[0].url).toBe("https://x.test/health");
    expect(f.calls[0].url).not.toContain("nsk_secret");
    expect(new Headers(f.calls[0].init.headers).get("authorization")).toBe("Bearer nsk_secret");
  });

  test("on 429 with Retry-After: 1 retries once after ~1s", async () => {
    const f = fakeFetch((_c, n) =>
      n === 1 ? new Response("slow down", { status: 429, headers: { "retry-after": "1" } }) : ok({ id: "a1" }),
    );
    const c = createNessieClient({ apiKey: "k", baseUrl: "https://x.test", fetchImpl: f.fn });
    const p = c.fetch<{ id: string }>("/accounts/a1");
    await vi.advanceTimersByTimeAsync(999);
    expect(f.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    await expect(p).resolves.toEqual({ id: "a1" });
    expect(f.calls).toHaveLength(2);
  });

  test("second 429 in a row surfaces NessieError with retryAfter", async () => {
    const f = fakeFetch(() => new Response("", { status: 429, headers: { "retry-after": "2" } }));
    const c = createNessieClient({ apiKey: "k", baseUrl: "https://x.test", fetchImpl: f.fn });
    const p = c.fetch("/accounts/a1");
    const assertion = expect(p).rejects.toMatchObject({ name: "NessieError", status: 429, retryAfter: 2 });
    await vi.advanceTimersByTimeAsync(2100);
    await assertion;
  });

  test("token bucket refuses the 31st burst call until refill", async () => {
    const f = fakeFetch(() => ok({}));
    const c = createNessieClient({ apiKey: "k", baseUrl: "https://x.test", fetchImpl: f.fn, ratePerMinute: 120, burst: 30 });
    const ps = Array.from({ length: 31 }, (_, i) => c.fetch(`/accounts/${i}`));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.calls).toHaveLength(30);
    await vi.advanceTimersByTimeAsync(500); // 120/min = one token per 500ms
    expect(f.calls).toHaveLength(31);
    await Promise.all(ps);
  });

  test("non-2xx non-429 throws NessieError with status and body", async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ error: "nope" }), { status: 404 }));
    const c = createNessieClient({ apiKey: "k", baseUrl: "https://x.test", fetchImpl: f.fn });
    await expect(c.fetch("/customers/zzz")).rejects.toBeInstanceOf(NessieError);
    await expect(c.fetch("/customers/zzz")).rejects.toMatchObject({ status: 404 });
  });
});

describe("nessie api wrappers", () => {
  test("createBill sends payment_amount in dollars while transfer sends amount_cents", async () => {
    const f = fakeFetch((call) =>
      call.url.endsWith("/bills")
        ? ok({ id: "b1", status: "recurring", payee: "Netflix", payment_amount: 15.99 })
        : ok({ id: "t1", kind: "transfer", status: "pending", medium: "balance", amount_cents: 12345 }),
    );
    const c = createNessieClient({ apiKey: "k", baseUrl: "https://x.test", fetchImpl: f.fn });
    const api = makeApi(c);
    await api.transfer("acc1", { payee_id: "acc2", amount_cents: 12345, description: "to savings" });
    await api.createBill("acc1", { status: "recurring", payee: "Netflix", amountCents: 1599, recurring_date: 15, nickname: "Netflix" });
    const transferBody = JSON.parse(String(f.calls[0].init.body));
    const billBody = JSON.parse(String(f.calls[1].init.body));
    expect(f.calls[0].url).toBe("https://x.test/accounts/acc1/transfers");
    expect(transferBody.amount_cents).toBe(12345);
    expect(f.calls[1].url).toBe("https://x.test/accounts/acc1/bills");
    expect(billBody.payment_amount).toBe(15.99);
    expect(billBody.amount_cents).toBeUndefined();
    expect(billBody.amountCents).toBeUndefined();
  });
});
