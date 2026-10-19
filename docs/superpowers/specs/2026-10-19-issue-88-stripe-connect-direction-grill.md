# Issue #88 — Payment facilitator / Stripe Connect direction (grill complete)

> **Status:** Grill **completed** 2026-10-19. Decision accepted as **ADR-0005**. Product docs patched the same day. Not an implementation ticket — Stripe Connect build is a later track.
>
> **Canonical decision:** `docs/adr/0005-stripe-connect-direction.md`  
> **Ticket:** https://github.com/jpsm83/restaurant-pos/issues/88 (closed `question`; decision recorded on the issue)

---

## What this session decided

- **EEA + UK**, single processor **Stripe Connect**, venue **merchant of record**, Imperium = Connect platform (not PayFac).
- Imperium-processed channels: **online, delivery, QR/self-order** only. Dine-in card = venue’s own reader.
- **Express**, one account per **Business**, **direct charges**, admin/owner-only KYC, go-live requires charges **and** payouts ready.
- Commission: **base only** on all commissionable sales at face price; **tips out**; **card recovery removed**; weekly charge on **Owner platform PM**; no application-fee skim.
- Venue bears Stripe rail fees; refunds/chargebacks re-finalise + commission adjustment; disputes evidence in Express Dashboard.
- Freeze: public hide + ops block + stop new Stripe captures; billing/pay still allowed.

---

## Artifacts written

| Artifact | Role |
| --- | --- |
| `docs/adr/0005-stripe-connect-direction.md` | Accepted ADR |
| `docs/product/payments-and-tax.md` | Connect, MoR, channels, roles, disputes |
| `docs/product/monetization.md` | Base-only commission; freeze visibility |
| `docs/product/business.md` | Stripe go-live checklist item |
| `docs/product/platform-billing.md`, `business-reports.md`, `sales-reports.md`, `overview.md`, `superadmin.md`, `gift-cards.md` | Aligned siblings |
| `AGENTS.md` | Monetization pointer (no card recovery) |
| ADR-0004 point 10 | Dropped card-recovery clause |

**Not done in this track:** Stripe implementation code; seed catalogue TypeScript still encodes card recovery until a build ticket removes it.

---

## Session metadata

- **Date:** 2026-10-19
- **Repo:** `restaurant-pos` / Project Imperium
- **Skills:** research + `grill-me` / `grilling`
- **Done:** finish grill · ADR · product-doc updates · issue decision comment
