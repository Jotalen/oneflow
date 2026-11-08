import type { Cents } from "@/lib/money";
import type { CarDeal } from "./money";

/**
 * Toyota prices and offers, loaded from toyota.com on Nov 8, 2026:
 * - starting MSRPs: toyota.com/deals-incentives (all-vehicles list)
 * - APR offers: toyota.com/deals-incentives/apr · lease offers: toyota.com/deals-incentives/lease
 * Offers are for qualified buyers (TFS credit approval) and end Nov 30, 2026.
 */
export const OFFERS_SOURCE = "toyota.com, Nov 8, 2026";
export const OFFERS_END = "2026-11-30";

export interface ToyotaModel { id: string; name: string; startingMsrp: Cents; aliases: string[] }
export interface AprOffer { modelId: string; aprPct: number; termMonths: number; bonusCash?: Cents }
export interface LeaseOffer { modelId: string; trim: string; monthly: Cents; termMonths: number; dueAtSigning: Cents }

export const TOYOTA_MODELS: ToyotaModel[] = [
  { id: "corolla", name: "2026 Corolla", startingMsrp: 2_332_500, aliases: ["corolla"] },
  { id: "corolla-hybrid", name: "2026 Corolla Hybrid", startingMsrp: 2_517_500, aliases: ["corolla hybrid"] },
  { id: "corolla-hatchback", name: "2027 Corolla Hatchback", startingMsrp: 2_478_000, aliases: ["hatchback"] },
  { id: "corolla-cross", name: "2026 Corolla Cross", startingMsrp: 2_533_500, aliases: ["corolla cross"] },
  { id: "prius", name: "2027 Prius", startingMsrp: 2_875_500, aliases: ["prius"] },
  { id: "camry", name: "2026 Camry", startingMsrp: 2_970_000, aliases: ["camry"] },
  { id: "gr86", name: "2027 GR86", startingMsrp: 3_150_000, aliases: ["gr86", "gr 86"] },
  { id: "rav4", name: "2026 RAV4", startingMsrp: 3_190_000, aliases: ["rav4", "rav 4"] },
  { id: "tacoma", name: "2026 Tacoma", startingMsrp: 3_254_500, aliases: ["tacoma"] },
  { id: "bz", name: "2026 bZ", startingMsrp: 3_498_000, aliases: ["bz"] },
  { id: "c-hr", name: "2026 C-HR", startingMsrp: 3_708_000, aliases: ["c-hr", "chr"] },
  { id: "gr-corolla", name: "2026 GR Corolla", startingMsrp: 4_052_000, aliases: ["gr corolla"] },
  { id: "sienna", name: "2026 Sienna", startingMsrp: 4_132_000, aliases: ["sienna", "minivan"] },
  { id: "grand-highlander", name: "2026 Grand Highlander", startingMsrp: 4_226_000, aliases: ["grand highlander"] },
  { id: "tundra", name: "2026 Tundra", startingMsrp: 4_289_000, aliases: ["tundra"] },
  { id: "4runner", name: "2026 4Runner", startingMsrp: 4_349_000, aliases: ["4runner", "4 runner"] },
  { id: "highlander", name: "2026 Highlander", startingMsrp: 4_627_000, aliases: ["highlander"] },
  { id: "land-cruiser", name: "2027 Land Cruiser", startingMsrp: 5_818_000, aliases: ["land cruiser"] },
];

export const APR_OFFERS: AprOffer[] = [
  { modelId: "corolla", aprPct: 4.99, termMonths: 48 },
  { modelId: "corolla-hybrid", aprPct: 4.99, termMonths: 48 },
  { modelId: "corolla-hatchback", aprPct: 4.99, termMonths: 48 },
  { modelId: "prius", aprPct: 4.99, termMonths: 48 },
  { modelId: "camry", aprPct: 4.99, termMonths: 48 },
  { modelId: "rav4", aprPct: 4.99, termMonths: 48 },
  { modelId: "tacoma", aprPct: 4.99, termMonths: 60 },
  { modelId: "bz", aprPct: 1.99, termMonths: 72, bonusCash: 25_000 },
  { modelId: "grand-highlander", aprPct: 4.99, termMonths: 48 },
  { modelId: "tundra", aprPct: 1.99, termMonths: 72 },
  { modelId: "4runner", aprPct: 4.99, termMonths: 48 },
  { modelId: "highlander", aprPct: 4.99, termMonths: 48 },
  { modelId: "land-cruiser", aprPct: 4.99, termMonths: 48 },
];

export const LEASE_OFFERS: LeaseOffer[] = [
  { modelId: "corolla", trim: "2027 Corolla LE", monthly: 28_900, termMonths: 39, dueAtSigning: 199_900 },
  { modelId: "corolla-hybrid", trim: "2027 Corolla Hybrid LE", monthly: 32_900, termMonths: 39, dueAtSigning: 199_900 },
  { modelId: "corolla-cross", trim: "2026 Corolla Cross LE", monthly: 36_900, termMonths: 39, dueAtSigning: 199_900 },
  { modelId: "camry", trim: "2026 Camry LE Hybrid", monthly: 31_900, termMonths: 39, dueAtSigning: 399_900 },
  { modelId: "rav4", trim: "2026 RAV4 LE Hybrid", monthly: 29_900, termMonths: 39, dueAtSigning: 399_900 },
  { modelId: "tacoma", trim: "2026 Tacoma SR5 Double Cab", monthly: 29_900, termMonths: 39, dueAtSigning: 399_900 },
  { modelId: "grand-highlander", trim: "2026 Grand Highlander XLE", monthly: 45_900, termMonths: 39, dueAtSigning: 399_900 },
  { modelId: "highlander", trim: "2026 Highlander XLE", monthly: 49_900, termMonths: 39, dueAtSigning: 399_900 },
  { modelId: "tundra", trim: "2026 Tundra SR5 CrewMax", monthly: 39_900, termMonths: 39, dueAtSigning: 499_900 },
];

/** Models named in a question, longest alias first so "corolla cross" beats "corolla". */
export function modelsIn(question: string): ToyotaModel[] {
  const aliases = TOYOTA_MODELS.flatMap((m) => m.aliases.map((a) => ({ m, a }))).sort((x, y) => y.a.length - x.a.length);
  const found = aliases.reduce<{ ids: string[]; text: string }>((acc, { m, a }) => {
    const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[-\s]/g, "[-\\s]?")}($|[^a-z0-9])`);
    if (!re.test(acc.text) || acc.ids.includes(m.id)) return acc;
    return { ids: [...acc.ids, m.id], text: acc.text.replace(re, " ") };
  }, { ids: [], text: question.toLowerCase() });
  return found.ids.map((id) => TOYOTA_MODELS.find((m) => m.id === id)!);
}

/** Toyota's APR offers are for well-qualified buyers; other tiers get the standard TFS rate. */
const OFFER_TIERS = new Set(["A", "B"]);
const STANDARD_TERM_MONTHS = 60;
const DOWN_PCT = 10;
const ROUND_TO: Cents = 10_000;

/** Every model as a priced deal: Toyota's offer APR when the tier qualifies, otherwise the TFS rate sheet. */
export function toyotaDeals(tier: string, aprFor: (tier: string, termMonths: number) => number): CarDeal[] {
  return TOYOTA_MODELS.map((m) => {
    const offer = OFFER_TIERS.has(tier) ? APR_OFFERS.find((o) => o.modelId === m.id) : undefined;
    const lease = LEASE_OFFERS.find((l) => l.modelId === m.id);
    return {
      id: m.id, model: m.name, price: m.startingMsrp,
      downPayment: Math.round((m.startingMsrp * DOWN_PCT) / 100 / ROUND_TO) * ROUND_TO,
      aprPct: offer?.aprPct ?? aprFor(tier, STANDARD_TERM_MONTHS), termMonths: offer?.termMonths ?? STANDARD_TERM_MONTHS,
      rateSource: offer ? "toyota-offer" : "tfs-standard", bonusCash: offer?.bonusCash,
      ...(lease ? { lease: { trim: lease.trim, monthly: lease.monthly, termMonths: lease.termMonths, dueAtSigning: lease.dueAtSigning } } : {}),
    };
  });
}
