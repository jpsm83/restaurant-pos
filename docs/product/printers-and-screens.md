# Printers and screens

> **About this document.** This is the **target-state source of truth** for printers and screens in Project Imperium — how a venue registers output devices, routes tickets, and runs the prep and pickup surfaces that control fulfilment. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes printers and screens as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how work leaves the till and how stations see and control it**. It covers:

- **printers** — logical printers a venue configures, the **print connectors** that reach physical hardware, and the **binding** between them;
- **routing** — which printer and which prep area or station receive a ticket, by category, subcategory, and sales point;
- **backup printers** and what happens when a print fails;
- **per-employee print permissions** for issuing and reprinting documents;
- **prep areas and stations** — configurable main screens and sub-screens for kitchen, bar, and any other prep the venue defines;
- the **control screens** — kitchen, bar, delivery/runner, and the **customer pickup board** — their gestures, queues, and history; and
- how those surfaces advance **fulfilment status** on each prep-area slice of a batch (the orders subject owns the status model; this subject owns the surfaces and the print path).

It deliberately does **not** cover:

- the **order and batch** — composition, send, identification code, held and don't-make rules, and the fulfilment status vocabulary belong to the orders subject. This subject routes and displays what that subject sends and records the station actions that move status.
- the **sales point** — types, channels, and instances belong to the sales-points-and-instances subject. This subject uses a point as a **routing target** and as the place that names its receipt printer.
- **business goods and menu structure** — categories and subcategories belong to the business-goods subject. This subject routes by them.
- **billing and payment** — settlement belongs to the payments-and-tax subject.
- **customer bill and receipt content, numbering, and reprint/replacement identity** — the **receipts-and-bills** subject owns document kinds, required fields, bill and receipt numbers, and when a reprint or replacement applies. This subject **prints** those documents on the sales point's receipt printer, may arrange their **layout** from the required fields, and gates paper issue with **print permission**; it does not invent or omit required content.
- the **daily sales report close** — the sales-reports subject owns closing the day; this subject states the fulfilment sweep that close triggers.
- **notifications and emails** — their subjects own delivery; this subject names the print-failure condition that notifies managers.
- **hardware sales or lock-in** — Project Imperium sells no printers or screens and requires no brand; the venue brings its own printers and optional displays. Staff identity devices are personal (staff-sessions subject), not a shared printer/screen login.
- **floor-plan placement** — where a printer or screen sits on a venue floor map belongs to the floor-plans subject. This subject owns creating and configuring those devices; a device may exist unplaced until a manager locates it on a floor.

---

## 2. Domain model and vocabulary

### Entities

- **Printer** — a **logical** output device the venue configures: a stable name, what it is for (receipt and/or prep), its routing participation, its optional **backup printer**, and its **binding** to physical hardware. The configuration survives hardware changes.
- **Print connector** — a small always-on helper on a local internet device at the venue that discovers the physical printers that device can reach and reports them to Project Imperium. A venue may run one or many connectors; one connector may expose many physical printers.
- **Binding** — the link from a logical **printer** to one physical printer exposed by a **print connector**. Rebinding changes hardware without changing routing or permissions.
- **Prep area** — a configurable fulfilment zone (for example kitchen or bar) with one **main screen** and optional **stations**. A batch may produce one **fulfilment slice** per area that receives lines.
- **Station** (sub-area) — a named prep post under a prep area (for example salad, fry, dessert, cocktail rail) with its own **sub-screen**. Routing may send lines to a station.
- **Control screen** — an in-app surface opened after sign-in: a prep area's **main screen** or **sub-screen**, the **delivery screen**, or the **customer pickup board**. Screens are not registered hardware devices; any internet device may open them.

### Terms this subject introduces

- **Logical printer** — the configured **printer** entity, as opposed to the physical machine it is bound to.
- **Physical printer** — a real printer a **print connector** has discovered on its device or local network.
- **Receipt printer** — a logical printer used for customer-facing documents: receipts, bills, and kiosk handover tickets.
- **Prep printer** — a logical printer used for kitchen/bar prep tickets. Prep printing is optional; control screens always show the work.
- **Backup printer** — another logical printer named as failover for a primary; used automatically when the primary cannot print.
- **Routing rule** — a rule that matches category and/or subcategory and/or sales point and sends matching lines to a prep area, optional station, and/or prep printer. More specific matches win.
- **Default prep target** — the venue's required fallback when no routing rule matches a line.
- **Main screen** — the chef or head-of-area control surface for a prep area; it gates **Preparing** and area **Ready**.
- **Sub-screen** — a station's control surface; it receives tickets only after the main screen has marked them **Preparing**, and only for lines routed to that station.
- **Delivery screen** — the runner surface that shows ready work to take out, in time order, with colour by fulfilment state.
- **Customer pickup board** — a counter-facing display of order codes in pending, in progress, and ready-for-pickup columns for self-pickup, kiosk, and on-premises to-go collection.
- **Display mode** — a locked presentation of the customer pickup board on a device the staff have signed into, safe to leave facing guests (codes and status only — no prices, names, or payment detail).
- **Force-ready** — a main-screen choice to mark every open station line on a ticket done and set the area slice **Ready** when sub-screens are still incomplete.
- **Print permission** — a per-employee capability that gates who may issue or reprint customer and prep prints.

Terms reused rather than redefined here: **Business**, **Batch**, **Identification code**, **Fulfilment slice**, **Fulfilment status** (**Sent**, **Preparing**, **Ready**, **Delivered**), **Held batch**, **Don't make**, **Sales point**, **Menu category**, **Menu subcategory**, **Business good**, **Deadline**, **managers on duty**, **managers and above**, **soft delete**, and **daily sales report**.

---

## 3. Capabilities

### 3.1 Hardware stance

- The venue brings its own **printers** and optional **dedicated displays** for prep and customer boards. Project Imperium sells none and locks the venue to no brand.
- **Staff identity** stays on each person's **own signed-in personal device** (staff-sessions subject). Printers and screens are output and control surfaces, not a shared staff login, PIN, or quick-switch station.
- **Control screens** always exist in the product: a person opens the screen they need after signing in with **their own** email and password. Connecting a dedicated display at a location is optional and does not change the service flow; the session on that browser is still that signed-in User’s.
- **Printing** is a required capability for customer documents. How many printers the venue has and where they sit is its choice; what each logical printer produces is fully configured.
- A venue may run **printer-only**, with tickets and verbal calling and little or no use of control screens; service continues. Status may still be advanced from the POS, and the daily close clears stragglers (§3.10).

### 3.2 Print connectors, printers, and binding

- Project Imperium does not reach venue printers by itself from the browser. Each venue runs one or more **print connectors** on local devices; each connector reports the **physical printers** it can see.
- Managers and above create **logical printers** with the full configuration the venue needs (name, receipt and/or prep role, backup, participation in routing).
- Each logical printer is **bound** to one physical printer on a connector. If hardware fails or moves, staff **rebind** the same logical printer to another physical printer; routing and permissions stay.
- Manufacturer cloud-print paths may expose a physical target the same way; binding stays the model.
- A venue that issues receipts or bills must have **at least one** configured **receipt printer** with a usable binding when those documents are issued. Prep printers are optional.

### 3.3 Prep areas, stations, and routing

- Under business configuration, the venue defines named **prep areas** and optional **stations**, each area's main and sub-screens, and **routing rules** from category, subcategory, and sales point to area, station, and prep printer. Suggested defaults (for example Kitchen and Bar) are offered; they are not mandatory.
- On send, a batch may produce a **fulfilment slice** for each prep area that receives at least one line. Food and drinks (and any other configured areas) run on **independent timelines**: drinks may become Ready and Delivered while food is still Preparing.
- Set-menu components follow each component's category into the right area. Lines that need no prep create no slice.
- Routing uses **most specific rule wins**. One batch may fan out across areas and stations. Unmatched prep lines use the venue's **default prep target**.
- **Receipt and bill printing** does not use prep routing: each sales point (including kiosk and delivery as needed) names which **receipt printer** it uses. Kiosk handover tickets print on that point's receipt printer.

### 3.4 Backup printers and print failure

- Each logical printer may name **one backup printer**. When the primary is unavailable (marked offline or detected failed), output goes to the backup automatically. Screens have no backup device.
- If the primary fails and there is no usable backup, that print is **blocked** with a clear error — it is never silently skipped. Prep screen flow and order taking continue. Staff retry or a manager rebinds or changes routing.
- A failed print **notifies the managers on duty** (or all manager-layer users for the business if none are on duty). Detecting the failure belongs to this subject; delivering the alert belongs to the notifications subject.

### 3.5 What prints

- This subject prints **prep tickets** (when a route names a prep printer), **customer receipts**, **bills**, and **kiosk handover tickets**.
- Prep paper is optional per route; the control screens always show the work. Customer documents always require a usable receipt-printer path when paper is requested.
- Customer bill and receipt **content and numbering** come from the receipts-and-bills subject. A paper **reprint** of an unchanged bill or receipt keeps that subject's number and reprint mark; layout still follows current routing and backup rules and is audited. Screens re-show work from **history** rather than reprinting.

### 3.6 Control screens — shared behaviour

- Screens are ordinary **in-app surfaces**. The manager on duty (or any user allowed to open that screen kind) signs in and opens each screen on the device at that location. **The same account may be signed in on many devices at once.** Whoever physically taps the device, actions run as the signed-in user — in practice the opener's responsibility.
- Gestures are **single-click** and **double-click** (or the equivalent pointer actions). Touch hardware is recommended at the pass but **not required**; mouse or trackpad works so venues that skip dedicated screens are not blocked.
- Every control screen has a **history** view to bring tickets back, send work back, or reverse a station step. Station staff may reverse steps for their own station; managers and above may reverse any. Reversals re-queue work in the right place and are audited.
- **Held** batches appear at the end of the relevant queue, visually distinct, and are **not activatable** until released from the tab (release stays on the tab, as the orders subject defines).
- Batches whose orders are all **don't make** never appear on prep or delivery screens.

### 3.7 Kitchen and bar main and sub-screens

- Each prep area has one **main screen**. Optional **sub-screens** follow the chef or head of bar.
- Ready-to-make tickets appear on the **main screen** when the batch is sent. A **single-click** marks the area slice **Preparing**. A ticket appears on a **sub-screen** only after that Preparing action, and only if it has lines for that station.
- On a sub-screen, **double-click** marks that station's lines done. Many tickets may be Preparing at once. The main screen shows a **per-line done indicator** for station work.
- The main screen **double-click** sets the area slice **Ready** only when every sub-line for that ticket is done — or when the ticket has no station lines. If subs are still open, the main offers a choice: **wait**, or **force-ready** (mark all remaining station lines done and set Ready). Force-ready needs **no reason and is not audited**.
- The same main/sub pattern applies to every prep area the venue configures (kitchen, bar, merchandise counter, and so on).

### 3.8 Delivery screen and customer pickup board

- The **delivery screen** lists work in time order. Colours distinguish still preparing, ready to run, and done. Runners act on **Ready slices** (not only fully complete batches): **double-click** marks that slice **Delivered** and removes it from the queue. Early drinks may be delivered while food is still preparing.
- The **customer pickup board** is opened by signed-in staff and left in **display mode** on a counter device. Guests do not log in. It shows order **identification codes** in columns for pending, in progress, and ready for pickup — progressive as slices become Ready, and complete when slices are Delivered. It shows no prices, guest names, or payment detail.

### 3.9 Advancing status without screens

- Control screens are the preferred surface. The **POS** may also set a slice Preparing, Ready, or Delivered under the same entitlements, so printer-only or manual-calling venues keep a normal service flow.

### 3.10 Daily close sweep

- When the **daily sales report closes**, every fulfilment slice for that business day that is not yet **Delivered** is moved to **Delivered** (advancing through Preparing and Ready as needed) so queues are clear. The sales-reports subject owns the close; this subject owns that fulfilment consequence.

### 3.11 Printer lifecycle

- A logical printer may be **deactivated** or removed from routing under the platform's soft-delete convention; print history remains. The venue cannot retire its **only** receipt printer while it still issues receipts or bills — another receipt printer must be assigned first. Backup links are cleared or reassigned on retire.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Printer and screen powers |
| --- | --- |
| **Customer** | Sees own order readiness on customer surfaces and the public-facing pickup board codes; never configures devices or routing. |
| **Employee** | Opens the control screens their job role or capability allows; runs prep, delivery, and history gestures on those screens; prints and reprints only with **print permission**. |
| **Supervisor** | Opens any Service control screen by default (prep, delivery, pickup); prints and reprints with print permission by layer default. Does not configure connectors, printers, routing, or grant print permissions. |
| **Manager** | Everything a supervisor can do, plus configuring connectors, logical printers, bindings, backups, prep areas, stations, routing, print permissions, and opening any control screen (including the pickup board in display mode). Receives print-failure alerts when on duty. |
| **Admin/owner** | Everything a manager can do, with full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Install and run print connectors; create, bind, rebind, and retire logical printers; set backups | Managers and above |
| Define prep areas, stations, and routing rules; assign sales-point receipt printers | Managers and above |
| Grant per-employee print permissions | Managers and above |
| Issue or reprint receipts, bills, kiosk tickets, and prep tickets | Users with **print permission** (supervisor layer and above always; employees when granted) |
| Open kitchen / bar (or other area) main and sub-screens | Job roles for that area; supervisors; managers and above; employees with the granting capability |
| Open the delivery screen | Runner / service roles that deliver; supervisors; managers and above; employees with the granting capability |
| Open the customer pickup board and display mode | Supervisors; managers and above; employees granted the capability |
| Single-click Preparing; double-click station done; main Ready; force-ready | Users allowed on that area's screens (session is the signed-in opener) |
| Double-click Deliver on a Ready slice | Users allowed on the delivery screen |
| Reverse a station step from history | That station's staff for their steps; managers and above for any |
| Advance fulfilment status from the POS | Same entitlements as the matching screen action |
| Receive print-failure notifications | Managers on duty (else all manager-layer users for the business) |
