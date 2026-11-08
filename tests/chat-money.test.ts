import { describe, expect, it } from "vitest";
import { carAffordability, paymentPlan, paySnapshot, solanaAutoBuy, type MoneyInputs } from "@/lib/chat/money";
import type { CarDeal } from "@/lib/chat/money";
import { modelsIn, toyotaDeals } from "@/lib/chat/toyotaOffers";
import { amortize } from "@/lib/engine/amortize";

const base: MoneyInputs = {
  incomeMonthly: 600_000, // $6,000/mo → $3,000 per paycheck
  paydayDay: 15,
  checkingAvailable: 200_000,
  cash: 1_000_000,
  plannedMonthly: 450_000, // budget plan → $1,500/mo left over
  essentialsMonthly: 250_000, // safety net = 4 months
  carPaymentMonthly: 40_000,
  creditTier: "A",
  highestCardApr: null,
  upcoming: [
    { label: "Rent", amount: 150_000, date: "2026-11-20" },
    { label: "Car payment", amount: 40_000, date: "2026-11-25" },
  ],
  today: "2026-11-07",
};

describe("paySnapshot", () => {
  it("splits monthly income into two paychecks and finds the next payday", () => {
    // Act
    const s = paySnapshot(base);
    // Assert
    expect(s.paycheck).toBe(300_000);
    expect(s.paydays).toEqual([15, 30]);
    expect(s.nextPayday).toBe("2026-11-15");
    expect(s.monthlyLeftover).toBe(150_000);
    expect(s.safetyNetMonths).toBe(4);
  });
});

describe("paymentPlan", () => {
  it("orders paychecks and bills by date with a running checking balance", () => {
    const plan = paymentPlan(base, 30);
    expect(plan.items.map((i) => i.label)).toEqual(["Paycheck", "Rent", "Car payment", "Paycheck"]);
    expect(plan.items[1].balanceAfter).toBe(200_000 + 300_000 - 150_000);
    expect(plan.shortfall).toBe(false);
  });

  it("flags a shortfall when a bill lands before the paycheck and checking can't cover it", () => {
    const plan = paymentPlan({ ...base, checkingAvailable: 10_000, upcoming: [{ label: "Rent", amount: 150_000, date: "2026-11-10" }] }, 30);
    expect(plan.shortfall).toBe(true);
    expect(plan.lowest.balance).toBe(10_000 - 150_000);
  });
});

describe("carAffordability", () => {
  const deal: CarDeal = { id: "rav4", model: "2026 RAV4", price: 3_190_000, downPayment: 320_000, aprPct: 4.99, termMonths: 48, rateSource: "toyota-offer", lease: { trim: "2026 RAV4 LE Hybrid", monthly: 29_900, termMonths: 39, dueAtSigning: 399_900 } };

  it("amortizes the financed amount at the deal's APR and term", () => {
    const [o] = carAffordability(base, [deal]);
    expect(o.monthly).toBe(amortize(3_190_000 - 320_000, 4.99, 48));
    expect(o.buy.paymentPctOfIncome).toBeCloseTo((o.monthly / base.incomeMonthly) * 100, 1);
  });

  it("checks the lease too, and says not affordable when upfront cash leaves under 3 months of essentials", () => {
    const [o] = carAffordability({ ...base, cash: 800_000 }, [deal]);
    expect(o.lease?.affordable).toBe(false);
    expect(o.lease?.reasons.join(" ")).toMatch(/safety net/i);
  });
});

describe("toyotaDeals", () => {
  it("uses Toyota's offer APR for qualifying tiers and the rate sheet otherwise", () => {
    const corollaA = toyotaDeals("A", () => 5.6).find((d) => d.id === "corolla")!;
    const corollaC = toyotaDeals("C", () => 11.1).find((d) => d.id === "corolla")!;
    expect(corollaA).toMatchObject({ aprPct: 4.99, termMonths: 48, rateSource: "toyota-offer" });
    expect(corollaC).toMatchObject({ aprPct: 11.1, termMonths: 60, rateSource: "tfs-standard" });
  });

  it("finds models named in a question, preferring the longer name", () => {
    expect(modelsIn("I want to buy a new GR86").map((m) => m.id)).toEqual(["gr86"]);
    expect(modelsIn("corolla cross or camry?").map((m) => m.id)).toEqual(["corolla-cross", "camry"]);
  });
});

describe("solanaAutoBuy", () => {
  it("5% of each paycheck fits when there is leftover and a 3-month safety net", () => {
    const r = solanaAutoBuy(base, 5);
    expect(r.perPaycheck).toBe(15_000);
    expect(r.monthly).toBe(30_000);
    expect(r.verdict).toBe("yes");
  });

  it("cautions while expensive card debt is open", () => {
    const r = solanaAutoBuy({ ...base, highestCardApr: { label: "Rewards Card", aprPct: 24.9 } }, 5);
    expect(r.verdict).toBe("caution");
    expect(r.reasons.join(" ")).toMatch(/24.9%/);
  });

  it("says no when the monthly amount is more than what's left over", () => {
    expect(solanaAutoBuy({ ...base, plannedMonthly: 595_000 }, 5).verdict).toBe("no");
  });
});
