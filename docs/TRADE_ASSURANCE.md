# Trade Assurance (escrow) — design only

**Status: not built, not enabled.** MarketplacePH never holds buyer funds. Escrow will only ever be offered
through a **licensed payment partner** (a BSP-authorised e-money issuer / payment-system operator), behind a
feature flag, after legal review. This document fixes the shape of the integration so the rest of the product
can be built without a rewrite later.

## What exists today

- `lib/escrow.ts` — a provider-agnostic `EscrowProvider` interface, the `EscrowHold` / `EscrowEvent` types, a
  registry (`registerEscrowProvider`) and `tradeAssuranceEnabled()`.
- `tradeAssuranceEnabled()` is `true` only when **both** `TRADE_ASSURANCE_ENABLED=true` **and** a provider has
  been registered. No provider exists, so it is always `false` and no UI shows Trade Assurance.
- Nothing in the database changes for escrow yet.

## Where it plugs into the order flow

The Phase 3 state machine already has every state we need:

| Order state | Without Trade Assurance (today) | With Trade Assurance (later) |
|---|---|---|
| `quoted` | buyer pays the seller directly (GCash / Maya / bank / COD) and uploads proof | buyer may opt in → `createHold()` → redirected to the **partner's** hosted checkout |
| `payment_submitted` → `paid` | seller reviews proof and confirms | `hold.funded` webhook marks the order `paid` (no manual proof) |
| `shipped` / `delivered` | unchanged | funds stay held |
| `completed` (buyer confirms) | done | `release()` → partner pays the seller |
| `cancelled` | done | `refund()` |
| `disputed` | admin decides with `resolve_dispute()` | `freeze()`; the admin decision calls `release()` / `refund()` (or a split, if the partner supports it) |

## Required before building

1. **Partner and licence.** A signed agreement with a BSP-regulated partner; confirmation of who is the
   regulated party (it must not be MarketplacePH holding funds). Legal review under the Internet Transactions
   Act (RA 11967), the E-Commerce Act, the Data Privacy Act (RA 10173) and BSP rules.
2. **Terms and fees.** Buyer/seller terms, fee schedule, payout timing, chargeback and dispute windows.
3. **Database.** `escrow_holds(order_id, provider, provider_ref, amount_centavos, status, created_at…)`, RLS
   limited to the two parties and admins, written only by service-role webhook handlers, audit-logged.
4. **Webhook endpoint.** `POST /api/escrow/webhook`: verify the partner's signature
   (`EscrowProvider.parseWebhook`), be idempotent on `providerRef`, and call the order functions through a
   service-only RPC (never trust a client to mark an order paid).
5. **UI.** An opt-in at quote time, a clear "who holds the money" explanation, and a status panel on the order page.
6. **Tests.** Provider sandbox contract tests plus a fake provider for CI covering fund → release, fund →
   refund, dispute → freeze → resolve, duplicate webhooks and bad signatures.

## Principles that must hold

- MarketplacePH is a venue, not a bank: no custody of funds, no stored-value balance.
- The existing manual-payment flow stays available; Trade Assurance is opt-in, never mandatory.
- Disputes still follow the fair-process rules (both sides heard) before funds move.
- Any money-moving call is server-side, audit-logged and idempotent.
