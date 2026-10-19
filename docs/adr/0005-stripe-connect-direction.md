# ADR-0005: Stripe Connect direction (venue merchant of record)

- **Status:** Accepted
- **Date:** 2026-10-19
- **Ticket:** GitHub issue #88

## Context

Project Imperium needs a way to take diner card money on self-channels and to collect platform commission without registering as a payment facilitator. Commission billed only against self-reported sales is leaky. Product docs previously assumed multiple integrated processors (Stripe, PayPal, Skrill), optional provider connect by managers, and a dual weekly fee (**base commission** + **card recovery**).

A grill on 2026-10-19 (issue #88) settled the commercial and Connect direction for EEA + UK stage 1.

## Decision

1. **Do not** register Imperium as a PayFac. Use **Stripe Connect** as the single third-party processor for Imperium-processed card money.
2. **Geography:** EEA + UK from the start. One Connect **platform** account serving those markets; Imperium’s legal-entity / platform-account country is deferred to counsel.
3. **Merchant of record:** the **Business (venue)**. Diners pay the restaurant. Imperium is software + Connect platform, not MoR for diner sales.
4. **Channels Imperium processes:** online, delivery, and QR / self-order only. In-premises dine-in card stays on the **venue’s own reader** (no Stripe Terminal in stage 1).
5. **Account model:** Stripe **Express**, **one connected account per Business**, country follows the Business address/country. **Direct charges** on the connected account. **Admin/owner only** completes Express onboarding.
6. **Go-live gate:** Express must be able to **accept charges and receive payouts** before go-live (Free and paid). Offline keeps the connection; **closure** stops Imperium using that Express account for the Business.
7. **Processor catalogue:** Stripe only for Imperium-processed capture in stage 1. PayPal and Skrill are **not** integrated processors. Venues may still **record** external tenders (cash, own reader, etc.).
8. **Money model:** Customer is charged the **face price**. Stripe fees come out of venue settlement. Imperium does **not** take commission via Connect application fees / payment skim. Imperium **aggregates base commission in product data** on **full face** commissionable sales (tips excluded) and **auto-charges the Owner’s platform payment method** weekly (platform-billing). The **venue** bears Stripe processing, refund, and dispute fees on its Express account.
9. **Card recovery:** **removed** from stage-1 monetization. Weekly commission is **base rate × commissionable sales** only.
10. **Commission perimeter:** all commissionable sales (Stripe self-channels and cash / venue-reader / gift card / etc.) at full face; tips never in the base.
11. **Refunds and chargebacks** that reverse commissionable product sales after weekly close **re-finalise** the week and trigger a **commission adjustment** (same path as edited dailies). Dispute **evidence** is handled in the Express Dashboard; Imperium records outcomes and adjusts commission.
12. **Presentation:** checkout, statement descriptor, and receipt seller name use the venue **trade name**. Imperium is not presented as the merchant of the meal.
13. **Tips** on Imperium-processed card payments ride the **same** diner charge as the bill, settle to the venue, and are recorded separately so they stay out of commissionable sales.
14. **Freeze:** portfolio or venue freeze **hides the Business from the public**, **blocks normal Service/Manage operation**, and stops new Imperium-processed Stripe charges; Owner/admin may still **see billing, pay arrears, and manage the platform payment method**.

Target-state product documents must match this decision. Implementation of Stripe Connect is a later build track.

## Consequences

- **Positive:** Clear MoR and tax posture (diner-facing tax on the venue; Imperium VAT on its own fees); verifiable self-channel card flows; commission stays on the existing B2B billing rail; go-live forces KYC before self-channels can take money.
- **Negative / follow-on:** Product and seed-catalogue code that still encode card recovery or multi-PSP must be brought in line when implementing; counsel must confirm EU/UK marketplace-facilitator tests for the exact packaging; dual Connect platforms only if counsel forces a split.
- **Supersedes** product statements that (a) begin the provider catalogue with PayPal and Skrill as integrated processors, (b) let managers connect the payment provider, (c) treat card recovery as part of weekly commission, and (d) leave connected-account direction undecided. Amends ADR-0004 point 10 by dropping the card-recovery clause (commissionable-sales rules for gift cards otherwise stand).
