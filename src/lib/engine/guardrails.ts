import type { Profile } from "./types";

export interface Guardrails {
  humanHandoff: boolean;
  noNewVehicleOffers: boolean;
  reasons: string[];
}

export const MISSED_PAYMENTS_HANDOFF = 2;
/** Option ids that are new-vehicle offers (blocked when marketing_consent = N). */
export const NEW_VEHICLE_OPTIONS = new Set(["TRADE", "RENEW"]);

/** Toyota starter-prompt rules 6–8, enforced in code (ADR-003). */
export function guardrails(p: Profile): Guardrails {
  const reasons: string[] = [];
  if (p.flags.vulnerable) reasons.push("Customer is flagged vulnerable");
  if (p.flags.missed12m >= MISSED_PAYMENTS_HANDOFF) reasons.push(`${p.flags.missed12m} missed payments in the last 12 months`);
  if (!p.flags.marketingConsent) reasons.push("No marketing consent: no new-vehicle offers");
  return {
    humanHandoff: p.flags.vulnerable || p.flags.missed12m >= MISSED_PAYMENTS_HANDOFF,
    noNewVehicleOffers: !p.flags.marketingConsent,
    reasons,
  };
}
