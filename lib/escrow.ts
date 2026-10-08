/**
 * Trade Assurance (escrow) — DESIGN ONLY.
 *
 * MarketplacePH never holds buyer funds. Escrow can only be offered through a LICENSED payment partner
 * (e.g. a BSP-authorised e-money issuer / payment-system operator), so this file defines the provider-agnostic
 * interface the order flow will call once a partner is signed — and nothing else. No provider is implemented,
 * the feature flag is off, and the order pages do not show Trade Assurance. See docs/TRADE_ASSURANCE.md.
 *
 * Intended flow (maps onto the existing order state machine):
 *   quoted ──buyer opts in──▶ createHold (partner collects & holds funds)
 *   paid   ◀── holdFunded webhook (replaces "buyer submits proof / seller confirms")
 *   delivered/completed ──▶ release (partner pays the seller)        cancelled/dispute-buyer-favoured ──▶ refund
 *   disputed ──▶ funds stay frozen until resolve_dispute() decides; the decision is passed to release/refund
 */

export type EscrowHoldStatus = "pending" | "funded" | "released" | "refunded" | "frozen" | "failed";

export type EscrowHold = {
  /** The partner's id for this hold. */
  providerRef: string;
  orderId: string;
  /** Centavos, to avoid float issues. */
  amountCentavos: number;
  status: EscrowHoldStatus;
  /** Where the buyer completes payment (partner-hosted page). */
  checkoutUrl?: string;
};

export type EscrowEvent = { type: "hold.funded" | "hold.failed" | "hold.released" | "hold.refunded"; providerRef: string; occurredAt: string };

export interface EscrowProvider {
  readonly name: string;
  /** Start a hold for an order; returns the partner-hosted checkout the buyer is sent to. */
  createHold(input: { orderId: string; amountCentavos: number; buyerId: string; sellerId: string; returnUrl: string }): Promise<EscrowHold>;
  /** Pay the seller after the buyer confirmed receipt (or a dispute was decided for the seller). */
  release(providerRef: string): Promise<EscrowHold>;
  /** Return funds to the buyer (cancellation, or a dispute decided for the buyer). */
  refund(providerRef: string): Promise<EscrowHold>;
  /** Freeze while a dispute is open. */
  freeze(providerRef: string): Promise<EscrowHold>;
  /** Verify and parse a signed webhook from the partner. Must throw on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<EscrowEvent>;
}

/** Off unless explicitly enabled AND a provider is registered. Both must be true. */
export const tradeAssuranceEnabled = () => process.env.TRADE_ASSURANCE_ENABLED === "true" && getEscrowProvider() !== null;

let provider: EscrowProvider | null = null;
/** Called once at startup by a future provider module (none exists yet). */
export function registerEscrowProvider(p: EscrowProvider) {
  provider = p;
}
export function getEscrowProvider(): EscrowProvider | null {
  return provider;
}
