# ADR-0015: Expo, handoff, ticket timing, and recall

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

The printers-and-screens subject already defines prep main/sub screens, a delivery screen, handover scan, and a customer pickup board. It does not define an **expo** surface, a **handoff** surface, ticket timers, or a recall gesture. It also states that fulfilment is **forward-only** and that history never reverses a station step (ADR-0006).

A grill on 2026-11-02 settled the missing kitchen surface model:

- The venue needs a whole-order coordination surface at the pass.
- Most venues run that coordination and the handoff from the same physical device; large venues split them.
- Runners deliver food; they do not operate screens.
- Tickets need an age/deadline display and a narrow way to recover a mis-bump.
- Kitchen performance reporting must be honest about whether the kitchen actually used the screen.

This ADR records the product boundary. It does **not** introduce an offline mode.

## Decision

1. **Four control-screen kinds.**
   - **Prep main screen** — one per prep area; gates `Preparing` and area `Ready`.
   - **Prep sub-screen** — one per station; station lines only, after the main screen marks `Preparing`.
   - **Expo screen** — whole-order coordination across every prep-area slice; can view and bump items and slices on behalf of stations; can set the batch ready for handoff when every slice is `Ready`.
   - **Handoff screen** — ready work, delivery/courier status, and the `Delivered` action.
   - The **customer pickup board** remains a display-only guest surface.

2. **Expo and handoff may share a physical device.** They are separate screen kinds with separate route and action scopes, but most venues open both under one display lease. A large venue may open a second device. **Runner** is a job role, not a screen; runners do not operate control screens.

3. **The delivery screen is renamed the handoff screen.** Its courier status, retry, and handover-scan behaviour stays. The handoff screen controls the delivery side of the flow; the expo controls production.

4. **Ticket fields.** Every prep ticket and control screen shows a mandatory core: identification code, order source/channel, packaging (`stay` / `to-go`), sent time, deadline/remaining time, guest allergen flags, order comments, and modifier selections. Optional per-venue fields are table/seat, server/creator, guest count, payment status, and customer name where the channel provides it.

5. **Ticket deadline and timer.** Each slice carries a deadline equal to the **longest preparation time of its lines** — main goods plus add-ons; `No` and choice groups do not change preparation time. The timer starts at `Sent`, or at release for a held batch, and is shown per slice on main, sub, expo, and handoff surfaces. Warning at 75%, late at 100%. No predictive queue time and no multi-item summing in this slice.

6. **Recall is a narrow exception to forward-only.** Within **5 minutes**, the station that fulfilled an item or ticket may recall it. After 5 minutes, a supervisor or above may recall before `Delivered`; managers and above may recall before `Delivered`. A recall moves `Ready` back to `Preparing`; `Delivered` never moves backward. The original sent time is kept, so the ticket shows late. Every recall is audited. This amends ADR-0006’s forward-only rule for this gesture only.

7. **Routing dimensions.** Routing may match **item**, **category**, **subcategory**, **channel**, **packaging**, and **sales point**, to a prep area, station, and/or prep printer. Most-specific rule wins; one line may route to more than one station; unmatched prep lines use the default prep target.

8. **Output selection is deployment, not a mode.** The prep screen always exists and shows the area’s work. A printer receives a ticket only when a route targets it. “Printer-only” means the station has no physical screen; it does not hide the software surface or change the flow. `Screen` / `Printer` / `Both` is not a behaviour switch.

9. **KDS performance reporting is data-quality gated.** KDS coverage is always shown for a period with fulfilment slices. The timing metrics (kitchen ticket time, kitchen station time, late kitchen tickets) are published only when **at least 80%** of the period’s fulfilment slices are **KDS-covered** — both `Preparing` and `Ready` set from a prep or expo screen. Below the threshold, the report shows “not enough KDS interaction” with the coverage figure. Printer-only venues still get sales, labour, inventory, and cost reports.

10. **Deferred.** Adhesive **label printing** for bags/cups and **all-day/production counts** are not in this slice.

## Consequences

**Positive**

- One physical pass device can run expo and handoff without pretending they are the same permission surface.
- Runners stay off screens; expo staff control production and handoff.
- Timers and deadlines are consistent across every kitchen surface.
- A mis-bump is recoverable without reopening the old “reverse any status” hole.
- Kitchen reporting is honest: it says when the kitchen did not use the screen.

**Negative / trade-offs**

- Two new screen kinds and a recall mutation add server route/action scope and audit work.
- Recall is a deliberate exception to ADR-0006; it must stay narrow and audited.
- The 80% coverage gate will hide kitchen metrics for low-adoption venues.
- Combo modifier display and member grouping remain UI-heavy.

**Follow-ups**

- Rename the delivery screen to handoff across product docs and code.
- Add the expo route and action scope, recall audit, and coverage calculation.
- Update ADR-0006 with the recall amendment.
- Add kitchen performance metrics to the daily, weekly, and monthly reports behind the coverage gate.

**Amends:** ADR-0006 (fulfilment forward-only), for the audited 5-minute recall gesture only.
