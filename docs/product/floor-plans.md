# Floor plans

> **About this document.** This is the **target-state source of truth** for floor plans in Project Imperium — the venue's spatial layout of sales points and hardware, and the day-of Service maps that use that layout. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes floor plans as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **spatial arrangement of a venue** and how staff **see and act on that arrangement** during service. It covers:

- **floor plans** — named levels or areas of a business (for example main floor, terrace, basement), including create, rename, reorder, and remove;
- the **background** of each floor — a fixed image from **upload** and/or **simple in-app draw** (no generative AI in this subject);
- **placement** of existing **sales points**, **printers**, and **screens** onto a floor as **vector markers**;
- the **unplaced** inventory of those objects until they are put on a floor;
- the **Manage** floor editor (both layers visible, layout editable);
- the **Service** maps on **POS** and **Host** (sales-point layer only; operational, not layout edit);
- **responsive presentation** of those Service destinations — wide viewport uses the map; narrow viewport falls back to list/grid.

It deliberately does **not** cover:

- **creating or configuring** sales points, printers, or screens — those objects are created and set up on their own Manage pages (sales-points-and-instances and printers-and-screens subjects). This subject only **places** them and opens their existing configuration from the editor. **Print connectors** are venue infrastructure for the print path and are **not** placed on floor plans.
- **prep stations as a separate created type** — kitchen and bar posts are **screens** placed on a floor; there is no third create-and-setup entity for “prep station.”
- **opening sittings, orders, billing, and fulfilment** — sales instances, orders, and control-screen work belong to their subjects. This subject provides the spatial entry (POS tap; Host richer detail) into those flows.
- **reservation booking rules** — accepts-reservations, deposits, assignment, and status lifecycle belong to the reservations subject. The Host floor is a **spatial entry** into that work, not a second booking system.
- **reserved-hold semantics** and derived available/occupied state — the sales-points-and-instances subject owns those facts; this subject only **colours** markers from them.
- **desktop chrome and left-menu structure** beyond naming where Floor plans, POS, and Host sit — the user-navigation subject owns chrome; this subject owns behaviour inside those destinations.
- **visual design, exact labels, and copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Floor plan** — one named level or area of a **Business** (for example main floor, terrace, basement). A business may hold **many** floor plans. Each may carry a **background** and a set of **placements**.
- **Placement** — the position of one placeable object on exactly one floor plan, drawn as a **vector marker** (shape or icon, size as needed). Placement does not create the object; it only locates an object that already exists.

### Terms this subject introduces

- **Background** — the fixed visual under the markers for one floor plan, produced by **uploading** an image and/or **drawing** a simple plan in-app. It is not interactive; markers sit on top of it.
- **Vector marker** — the on-canvas representation of a placed sales point, printer, or screen. Markers are shapes and icons with status colour where applicable — not per-object photo uploads.
- **Sales-point layer** — the set of placements for sales points on a floor. Visible in Manage and in Service (POS and Host).
- **Hardware layer** — the set of placements for **printers** and **screens** on a floor. Visible and editable in Manage; **hidden** on Service maps.
- **Unplaced** — a sales point, printer, or screen that exists for the business but has **no** placement on any floor. Unplaced objects appear in the Manage editor **palette** until placed.
- **Floor tab** — the control on a Service map (and in the Manage editor when several floors exist) that selects which floor plan is in view.
- **POS floor map** — the wide-viewport home of **Service → POS**: sales-point markers on the selected floor; single activation opens or views the sitting as the sales-points and order-flow subjects define.
- **Host floor map** — the wide-viewport **Service → Host** destination: the same layouts and sales-point layer, used for seating and reservation context; a host activation opens **richer table and reservation detail** owned in substance by the reservations and sales-points subjects.
- **List/grid fallback** — the narrow-viewport presentation of the same POS or Host destination when the screen is too small for a usable map.

Terms reused rather than redefined here: **Business**, **Sales point**, **Served point**, **Kiosk**, **Delivery** (virtual sales point), **Printer**, **Screen** (control screen / prep surfaces as the printers-and-screens subject defines them), **Reserved hold**, **Available**, **Occupied**, **Sales instance**, **Host**, **managers and above**, **soft delete**, **Service**, **Manage**, and **POS**.

---

## 3. Capabilities

### 3.1 Many floors per venue

- A business may define **zero or more** floor plans, each with a name unique among that business's active floors.
- Staff switch floors with **floor tabs** in the Manage editor and on Service maps when more than one floor exists.
- Floor plans follow soft delete: removing a floor unplaces its markers (see §3.6) and retires the floor without destroying sales points, printers, or screens.

### 3.2 Background

- Each floor plan may have a **background** set by **upload**, by **simple in-app draw**, or by combining those means as the product allows.
- Generative AI is **not** part of this subject: the venue supplies or draws the background directly.
- Clearing or replacing the background does not move or remove markers.

### 3.3 What may be placed

- **Sales points:** every **served** type and **Kiosk** may be placed. The virtual **Delivery** point is **never** placed on a floor plan.
- **Hardware:** **printers** and **screens** may be placed. Prep posts are represented by placing the relevant **screens**, not by a separate prep-station entity.
- Objects are **created and configured** on their own Manage pages first. The floor editor only **places** named objects from the inventory.

### 3.4 Placement rules

- An object may sit on **at most one** floor plan. Once placed, it is on **exactly one** floor until unplaced or moved.
- **Unplaced** is allowed: newly created sales points, printers, and screens start unplaced and remain in the Manage **palette** until dropped onto a floor.
- **Move between floors** is an explicit move (or remove-from-floor then place on another). An object never appears on two floors at once.
- **Remove from floor** returns the object to the unplaced palette. It does **not** delete or soft-delete the sales point, printer, or screen.

### 3.5 Manage → Floor plans (editor)

- **Floor plans** is its **own top-level Manage** destination (not nested under Venue or Service setup).
- **Managers and above** may create and rename floors, set backgrounds, place and move markers, remove placements, and reorder floors as the product provides.
- The canvas shows **both layers** (sales points and hardware).
- The **palette** lists unplaced placeable objects. Dragging onto the canvas creates a placement; the marker may be moved on the canvas.
- **Double-click** (or equivalent) on a marker opens that object's **existing** configuration UI — the same sales-point, printer, or screen configuration owned by those subjects. Floor plans do not invent a second settings model.
- Layout edit is **Manage-only**. Service maps never rearrange markers or change backgrounds.

### 3.6 Deleting a floor

- Removing a floor **unplaces** every object that was on it (back to the palette). It does **not** delete those objects.
- The floor itself is soft-deleted per product conventions.

### 3.7 Service → POS

- On a **wide enough** viewport, **POS home is the floor map**: choose a **floor tab**, see **sales-point markers only** (hardware hidden).
- Each marker shows a **minimal glance**: the point's **name** (or number) and a **colour** for **available**, **occupied**, or **reserved hold** (derived from the sales-points subject). Richer operational detail is not on the marker by default.
- **Single activation** (click/tap) opens or views that point's sitting as POS and the sales-points / order-flow subjects already define.
- On a **narrow** viewport, the same POS destination uses a **list/grid** instead of the map. The list/grid includes **all operable sales points** for service (including **unplaced** points and **Delivery**); the map shows only **placed** points on the selected floor.
- Until the venue has **at least one** floor plan, POS uses **list/grid only** (no empty map chrome).
- Ordinary employees and entitled staff use POS per existing POS entitlements; this subject does not add a separate POS capability.

### 3.8 Service → Host

- **Host** is a **separate Service left-menu destination** from POS. It uses the **same floor layouts** and **sales-point layer**.
- On a wide viewport, Host shows the floor map with the same minimal marker glance; **Host activation** (double-click or equivalent) opens **richer table and reservation detail** for that point — seating, holds, and booking context as the reservations and sales-points subjects define. Host does not replace those subjects' rules.
- On a narrow viewport, Host uses **list/grid** with the same richer-detail action.
- With **no** floor plans yet, Host uses list/grid only, same as POS.
- **Host and above** may open Host: the **Host** job role, **supervisor** layer (full Service default), and **managers and above**. Ordinary employees without Host do not see this destination unless a job role or entitlement grants Host.

### 3.9 Layers in Service vs Manage

| Context | Sales-point layer | Hardware layer | Layout edit |
| --- | --- | --- | --- |
| Manage → Floor plans | Visible | Visible | Yes (managers+) |
| Service → POS | Visible | Hidden | No |
| Service → Host | Visible | Hidden | No |

---

## 4. Roles and entitlements

### Base access layers

| Layer | Floor-plan powers |
| --- | --- |
| **Customer** | None. Floor plans are business-only. |
| **Employee** | Service → **POS** map or list/grid as POS entitlements allow. No Manage editor. No Host unless they also hold Host. |
| **Supervisor** | Service → **POS** and **Host** by layer default. No Manage editor. |
| **Manager** | Everything an employee can do, plus **Manage → Floor plans** (full editor), full Service POS, and **Service → Host**. |
| **Admin / Owner** | Everything a manager can do. |

### Job roles

- **Host** (and any higher role that includes Host powers) may use **Service → Host**. **Supervisor** layer and managers and above include those powers.

### Per-user capabilities

This subject introduces **no** separate per-user capability for layout edit. Floor editing is gated by **managers and above**. POS and Host follow the entitlements above and those subjects' rules for opening sittings and managing reservations.

### Who can do what

| Activity | Who |
| --- | --- |
| Create, rename, reorder, or remove a floor plan | Managers and above |
| Set or clear a floor background (upload / draw) | Managers and above |
| Place, move, or unplace sales points, printers, and screens | Managers and above |
| Open object configuration from a Manage marker | Managers and above (subject to that object's own edit rules) |
| Use Service → POS floor map or list/grid | Everyone in Business entitled to POS |
| Use Service → Host floor map or list/grid | Host job role; supervisor layer; managers and above; or other entitlement granting Host |
| Rearrange layout from Service | Nobody — Manage only |
