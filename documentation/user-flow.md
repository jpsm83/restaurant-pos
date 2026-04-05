## Restaurant POS – End-to-End User Flow

This document describes **how the app works from a user perspective**, from initial setup by management to day‑to‑day service, purchasing, inventory, and reporting. It is derived from `context.md` and the documented subsystems.

---

## 1. Onboarding and initial configuration (owner / manager)

- **Create business (tenant)**
  - The owner or manager creates a **Business** in the system (onboarding/start‑business flow).
  - **Web app:** From the public **business** marketing site (**`/business`**), **Sign up** in the top bar (or the **Register your business** action on that page) opens **`/business/register`**, a multipart form that calls **`POST /api/v1/business`**. On success, the browser receives the **business** session (access token + refresh / **`auth_mode`** handling like login) and lands on the tenant shell **`/business/:businessId`**.
  - This business is the **tenant**: all data (employees, tables, orders, stock, reports, etc.) is scoped by `businessId`.
  - At this stage the business can also configure **currency**, subscription, and optional **metrics/targets**:
    - Target cost percentages (food, beverage, labour, fixed).
    - **Supplier‑good waste thresholds** by budget impact (very low → very high).

- **Create users (people identities)**
  - A **User** is the app‑level identity for a person (username, email, password, address, avatar). Users log in with the **same sign-in form** as the business (email + password); the app decides whether the email belongs to a **Business** or a **User** and routes accordingly.
  - Users can later:
    - Be linked to an **Employee** record (staff identity). When linked, the user has both options: use the app as a normal **customer** or, when scheduled, as an **employee** (see **Login and flow routing** below).
    - Receive **notifications** in a personal inbox with read/deleted flags.
    - Act as customers in self‑service or marketing scenarios.

- **Login and flow routing**
  - **Frontend (web app) — public marketing (Phase 1):** Before sign-in, the site exposes two **anonymous** landing pages: a **customer** story at **`/`** and a **business** story at **`/business`**. The top bar includes a **Customer \| Business** control that only switches between those URLs while the visitor is **not** authenticated (marketing “audience” only — it is not the same as session type `business` vs `user`, nor employee vs customer **mode** after login). **Sign in** links add **`?audience=customer`** or **`?audience=business`** to match the current page; **Sign up** points to **`/signup`** from the customer site or **`/business/register`** from the business site. **UI language:** the navbar **language** control switches the app between **English** and **Spanish** for user-visible copy (marketing, auth forms, mode page, errors, etc.); see [`frontend-i18n.md`](./frontend-i18n.md). After login, that marketing toggle is hidden; routing follows session type and mode as below.
  - **Sign-in email verification and password recovery (web app):** New **User** and **Business** accounts may receive a **confirmation email** after signup/register (non-blocking). Users can still **log in** before verifying; the session exposes **`emailVerified`** so the UI can prompt to resend or open **`/request-email-confirmation`**. **Forgot password** uses **`/forgot-password`** (generic success message to limit account enumeration). **Reset** and **confirm** links land on **`/reset-password?token=…`** and **`/confirm-email?token=…`**. Authenticated users can **resend confirmation** from profile/credentials flows where implemented. Full mechanics (tokens, rate limits, refresh invalidation after password change) are in [`auth-email-security-flows.md`](./auth-email-security-flows.md) and [`authentication-and-session.md`](./authentication-and-session.md).
  - After sign-in, the app redirects based on session type:
    - **Business** → tenant business shell (e.g. **`/business/:businessId`** in the web app; product-specific admin paths may evolve).
    - **User** without an employee link → customer shell (e.g. **`/:userId/customer`**, self‑ordering, reservations).
    - **User** linked to an employee → **mode-selection** page (e.g. **`/:userId/mode`**): “Continue as customer” or “Continue as employee”. For **non-admin employees**, the **employee** option is enabled only when the user is **scheduled for that day** and the current time is within **5 minutes before the shift start** until the shift end; otherwise the button is visible but disabled. Employees whose `allEmployeeRoles` includes the **Admin** role can log in as employee at any time (no schedule or 5‑minute window required).
  - **Mode UI, countdown, and `auth_mode` cookie (Phase 3 — web app):**
    - The mode page (**`/<userId>/mode`**) presents two primary actions (**Continue as customer** / **Continue as employee**). Each calls **`POST /api/v1/auth/set-mode`** with body **`{ "mode": "customer" }`** or **`{ "mode": "employee" }`**, then navigates to **`/<userId>/customer`** or **`/<userId>/employee`**. The server sets an **HttpOnly** **`auth_mode`** cookie; the client reads it via **`GET /api/v1/auth/mode`** (TanStack Query + **`AuthModeProvider`** (`context/AuthModeContext`) on user-shell routes).
    - When **`canLogAsEmployee`** is **false** because of **schedule timing**, the app fetches today’s rows for that user from **`GET /api/v1/schedules/business/:businessId/daily`** (optional query **`dayKey=YYYY-MM-DD`**) and shows a **live countdown** until **five minutes before the next shift start** (aligned with backend **`canLogAsEmployee`**). When the countdown finishes, or when the schedule indicates the window is open but the JWT is stale, the app **refetches `/auth/me`** so **`canLogAsEmployee`** updates. If **`canLogAsEmployee`** is already **true** (e.g. management bypass), **no** countdown is shown.
    - **`Logout`** clears **`auth_mode`** on the server; the client also drops cached mode on **`AUTH_CLEAR`**.
  - **Web app — authenticated route partitions (Phase 2):** The browser **`userId`** / **`businessId`** segments must equal the logged-in session’s **`id`** (Mongo ObjectId string from JWT); guards redirect to the canonical URL if they differ. This is **client routing hygiene** only — authorization remains on the API.
    - **Business (`type: business`):** Shell at **`/business/<id>`** (dashboard placeholder today). Stack: **`ProtectedRoute`** → **`RequireBusinessSession`** → **`BusinessIdRouteGuard`**.
    - **User (`type: user`):** **Customer** area at **`/<userId>/customer`** with **`CustomerLayout`** (logout; link to **`/<userId>/employee`** only when the session includes **`employeeId`** and **`canLogAsEmployee === true`**; POS features inside the employee shell evolve separately). **Mode** screen at **`/<userId>/mode`** after login when the session carries **`employeeId`**. **Employee** area at **`/<userId>/employee`** uses **`EmployeeLayout`** (separate from customer chrome) and is only shown when the browser’s **`auth_mode`** cookie is **employee** (after **Continue as employee** on the mode page); a bookmark or deep link to **`/<userId>/employee`** while mode is still **customer** **replaces** the history entry to **`/<userId>/mode`** so the user can pick customer vs employee again (or retry after a failed mode read). Stack for employee routes: **`ProtectedRoute`** → **`RequireUserSession`** → **`UserIdRouteGuard`** → **`RequireEmployeeAuthMode`**.
    - **Wrong partition** (e.g. a **User** session opening **`/business/...`** or a **Business** session opening **`/:userId/...`**): **`/access-denied`** with a path back to the user’s canonical workspace.
    - **Legacy `/app`:** Still behind auth; **business** → **`/business/<id>`**; **user** → **`/<userId>/customer`** (not forced through **`/mode`**). **Unknown paths (`*`):** authenticated → same target as post-login (**`getPostLoginDestination`**); anonymous → **`/`**.
  - This keeps the user as a single **individual identity** (customer by default) while allowing the business to grant them an employee role and the app to gate employee access by schedule (with an explicit bypass for admins).

- **Register employees and roles**
  - Manager creates **Employees** for the business and links each to an existing **User** by email.
  - Each employee can have:
    - One or more roles (`allEmployeeRoles`) such as waiter, bartender, manager, admin.
    - Operational flags like `active`, `onDuty`, and `currentShiftRole`.
    - HR data: join date, vacation allowance/balance, salary (frequency + gross/net).
  - The creation/update of employees keeps the **User ↔ Employee** link consistent in transactions.
  - **Manager roles** (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor) can close daily/monthly reports and perform manager actions at any time (no on-duty requirement). **Non‑manager** employees must be on duty for operational actions (e.g. opening tables), and on‑duty state continues to drive day-to-day attribution of sales and tips.

- **Configure schedules and labour cost (required for employee login; optional only if you never use employee mode)**
  - Manager defines **Schedules** for each day:
    - One schedule per business per calendar day, with multiple **employee shifts** attached.
    - Each shift stores employee, role, time range, optional `vacation` flag, **shift hours** and **employee cost**.
  - Schedules enforce:
    - No overlapping shifts for the same employee on the same day.
    - Correct handling of vacation days (deducting/returning from `vacationDaysLeft`).
  - Aggregates per day (total staff count, vacation count, daily labour cost) later feed into **monthly business reporting** and labour KPIs.
  - For **non-admin employees**, schedule configuration is what allows or blocks “Continue as employee” at login (with access from 5 minutes before shift start until shift end). Employees with the **Admin** role can always log in as employee even when not scheduled.

- **Set up suppliers and supplier goods**
  - Manager registers **Suppliers** (vendors) used by the business.
  - For each supplier, manager defines **Supplier goods** (catalog):
    - Name, category, measurement unit (e.g. liters, kg, units).
    - Default or last price, and **budget impact** level (used for waste analysis).
    - Optional images and metadata.
  - Supplier goods are the **ingredients** that later power:
    - **Business goods** (menu items) recipes.
    - **Purchases** (what was bought, at what quantity/price).
    - **Inventories** (what is in stock).

- **Design the menu (business goods)**
  - Manager defines **Business goods** – the items the restaurant actually sells:
    - Simple items (no recipe, just a sellable item).
    - Ingredient‑based items (recipe tied to supplier goods and quantities/units).
    - Set menus / combos (collections of other business goods or ingredients).
  - For ingredient‑based and combo items, the system can:
    - Derive **cost price** from the underlying supplier goods and their quantities.
    - Derive **allergens** from the ingredients.
    - Help suggest a **selling price** using target **gross margin**.
  - Business goods are what appear on orders and bills; they are also the bridge to stock usage.

- **Configure promotions**
  - Manager defines **Promotions** at the business level:
    - Rules like % discounts, happy hours, “2x1”, fixed amount off, etc.
    - Scoping by goods, categories, time windows, and other conditions.
  - The **front end applies these rules in real time** when staff or customers create orders; pricing and discounting are computed on the fly for each order line.

- **Create sales points (tables, bar, rooms)**
  - Manager configures **Sales points** that represent where customers sit or are served:
    - Physical tables in rooms, bar seats, service counters, etc.
  - Each sales point can be:
    - Linked to **QR codes**. The **same QR** can be used by **staff** to open the table (scan → open table only) or by **customers** to self-order when the sales point has **selfOrdering: true**.
    - Linked to **Printers** / printer groups for routing orders (e.g. kitchen vs bar).
  - Sales points are the anchors for **Sales instances** (open checks/tabs) during service.

- **Configure printers**
  - Manager registers **Printers** for the business:
    - E.g. kitchen printer, bar printer, counter printer.
  - Sets up routing rules:
    - By **category** (drinks go to bar printer, food to kitchen printer).
    - By **sales point** or zone (e.g. specific rooms).
  - The system uses this configuration to decide where each order line is printed.
  - Manager also configures which **employees are allowed to print data** (bills, reports) from which printer; each employee should be allowed to print from at most one printer.

- **Optional: Set up notifications**
  - Manager configures **Notifications** for operational events or messages.
  - Users per business receive notifications in an **inbox**, with read/deleted status.
  - This can be used for alerts (e.g. stock issues), promotions, or internal communication.
  - **Business profile updates:** when the tenant saves changes on **`PATCH /api/v1/business/:businessId`** from split settings screens that submit the profile form (e.g. **profile** **`BusinessProfileSettingsPage`**, **address** **`BusinessAddressSettingsPage`**), the backend dispatches **`BUSINESS_PROFILE_UPDATED`** when persistence actually changes data: **management** employees get **in-app** notifications and **email** (when those channels are enabled), using the same unified `dispatchEvent` path as other domain notifications; see `backend/src/communications/README.md`. The **credentials** screen (**`/settings/credentials`**) triggers **password reset by email** only (no profile PATCH from that page).
  - **Business address (postal) settings:** On **`/business/:businessId/settings/address`** the tenant edits the same **`IAddress`** fields used elsewhere (including optional **door** and **complement**). A **map preview** geocodes a comma-joined query (street-first; **door** and **complement** are omitted from the geocode string only so Nominatim can find the building). The map **geocodes immediately** when a valid query first appears, then **waits 3 seconds** after further edits before searching again. See **`context.md`** (*Business address settings — location preview*).

---

## 2. Day-opening and employee check‑in (manager / staff)

- **Employees go on duty**
  - At the start of a shift, employees are considered **on duty** according to schedules or manual status.
  - Their **current shift role** is set (e.g. waiter, manager on duty).
  - This determines permissions (e.g. who can close the daily report) and attribution of sales/tips.

- **First sales instance opens the daily report**
  - When the **first Sales instance** of the day is opened (for any sales point):
    - The system automatically creates the **Daily sales report** for that business (if there isn’t already an open one).
    - A **dailyReferenceNumber** (timestamp) is generated and stored on that report.
  - Every sales instance and every order created that “work day” stores this same `dailyReferenceNumber`, which is how reporting knows which day each sale belongs to.
  - The daily report starts empty and will later be **calculated** from orders and sales instances to aggregate sales, tips, COGS, payment methods, self‑ordering sales, etc.

---

## 3. Live service – tables, orders, and payments

### 3.0 Reservations (booking → service handoff)

Reservations are the **booking layer** that can be created by a **customer** or by **staff**, and then handed off into live service (tables / sales instances).

- **Customer-created reservation**
  - Customer creates a reservation request (party size + desired time).
  - The reservation is created with status **Pending**.
  - Customer receives an **email** + **in-app notification** that the reservation is pending approval.
  - **Managers on duty** receive an **in-app notification** to approve or reject.
  - When staff sets the reservation to **Confirmed** or **Cancelled**, the customer receives an **email** + **in-app notification** with the decision.

- **Staff-created reservation**
  - Staff creates a reservation directly for the business as **Confirmed** immediately when the staff member's *effective role* is currently **employee** (on duty + schedule window, with admin bypass). Otherwise the reservation is created in the **Pending** customer flow.

- **Arrival / seating**
  - When guests arrive, staff can mark the reservation as **Arrived**, then **Seated**.
  - When a reservation is seated, the system creates a **SalesInstance** (open session) for the assigned **SalesPoint** (table/room) and stores its id on the reservation.
  - On the **first order** created for that SalesInstance, the system sets `SalesInstance.reservationId` so consumption is attributed to the reservation.
  - When the SalesInstance is **fully paid and closed**, the reservation becomes **Completed**.

- **Table moves**
  - If staff changes the reservation’s assigned table (SalesPoint), the linked SalesInstance is moved to the new SalesPoint as well.
  - If staff moves the SalesInstance to a different SalesPoint, the reservation’s SalesPoint is updated to match.

### 3.1 Opening a table / sales instance (waiter / bartender / customer via QR)

Role (customer vs employee) is determined by session/context; the app does not require a separate mode choice for this flow.

- **Staff‑opened session**
  - A waiter or bartender can open a table in two ways: (1) select a **Sales point** (table/bar seat) in the **POS UI**, or (2) **scan the table’s QR code** (one QR **per** sales point; identity from session: **userId**; same outcome as opening from POS). Opening from the POS or via QR requires the user to be an **effective employee** for that business (on duty + schedule window; admins bypass the schedule window but still must be on duty).
  - They **open a Sales instance** for that sales point. The system stores **openedByUserId** (ref User) and **openedAsRole: 'employee'**; the **responsible** user can be set or changed later (**responsibleByUserId**).
  - At most **one non‑closed sales instance per sales point per work day** (per business).
  - From this moment the table is **occupied**, all orders are attached to that sales instance, and it is linked to the **current Daily sales report**. **When a table is opened by an employee, customers cannot use the QR to self-order at that table until the table is closed**; orders are taken only by staff.

- **Self‑ordering via QR**
  - A **customer** can use the **QR code** at a sales point to self-order **only when that sales point has self-ordering enabled** and **no open sales instance exists at that table** (otherwise the table is service-only or already staff-served). The customer is logged in as **User**.
  - The self‑ordering flow:
    - Customer opens a session for that table or seat (if none is open, the system creates a new **sales instance** with **openedByUserId** = session userId and **openedAsRole: 'customer'**).
    - Customer browses **Business goods** (menu) with real‑time promotions applied.
    - Customer places orders (**createdByUserId**, **createdAsRole: 'customer'**), which create **Orders** tied to that sales instance.
    - Depending on configuration, customer may also **pay directly** in the self‑ordering flow. (Enforcing **payment before orders are sent** for self‑order and delivery is under study; third‑party payment integration is not yet implemented.)
  - After the order is paid and the table closed, the customer receives an **email** and an **in-app notification** with the order confirmation/receipt (ref, total paid); they can show either to staff when collecting the order.
  - Self‑ordering sales are tracked in **Daily sales report** in **selfOrderingSalesReport** (keyed by **userId**).

### 3.2 Taking and managing orders (waiter / bartender / customer)

- **Creating orders**
  - From an open **sales instance**, staff (or the customer in self‑ordering) adds **Orders**:
    - Each order has one **main product** (businessGoodId) and optional **addOns**; **promotions** apply only to the main product. Quantity is expressed as multiple orders (e.g. 3 beers = 3 orders).
    - The system calculates discounts and totals in real time using **Promotion** rules.
  - When an order is created:
    - It is grouped under the current **sales instance** and attributed by **createdByUserId** (ref User) and **createdAsRole** (employee | customer).
    - Identity is taken from the session (userId); no employeeId or customerId is sent in request bodies.
    - The system interfaces with **Printers**: routes each line to the right printer(s) based on category and sales point.

- **Inventory impact from orders**
  - For **ingredient‑based** and **combo** business goods, each order:
    - Consumes the corresponding **Supplier goods** (ingredients) from inventory.
    - Stock is decremented immediately or as defined by the inventory rules.
  - If an order is **cancelled**:
    - The system **restores** the consumed supplier goods to inventory.
  - If an order is marked as **void** or **invitation/complimentary**:
    - It still affects reporting (e.g. voided/complimentary goods) and may influence cost and waste metrics.

- **Modifying orders during service**
  - Staff can add new orders, transfer orders between tables/sales points, and (for **management roles** only) cancel, void, or mark orders as invitation/complimentary.
  - **Cancel, void, and invitation/complimentary** are restricted to staff with a **management/superior role** (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor). Only they can:
    - **Cancel** orders (order is removed and inventory restored).
    - **Void** orders (order remains in reporting but is marked void; a **reason is required**: waste, mistake, refund, or other).
    - Mark orders as **invitation/complimentary**.
  - **Void reason** is required when voiding and is stored on the order (e.g. in comments) for audit and reporting.
  - All actions are tracked so that:
    - Inventory is kept in sync (consumption vs restoration).
    - The **Daily sales report** knows what was sold, voided, or given away when it is calculated.

### 3.3 Billing and closing tables (waiter / cashier / customer)

- **Preparing the bill**
  - When the guest is ready to pay, staff opens the **sales instance** for that table.
  - They can:
    - Review all open orders, discounts, and promotions.
    - Split bills as supported by the front end (e.g. by items, by guests).
  - The system calculates:
    - **Order totals**, including promotions and taxes (if configured).
    - **Tips** and service charges (if entered).

- **Accepting payments**
  - Staff selects **payment methods** per bill or partial bill (e.g. cash, card, vouchers).
  - When an order or bill is **closed with payment**:
    - The related orders are marked as **closed/paid**.
    - **Payment method breakdown** is recorded for reporting.
    - Tips are assigned to employees and captured in daily totals.

- **Closing the sales instance / table**
  - When all orders in a sales instance are closed and paid:
    - The system can **close the sales instance** (**closedByUserId** = responsible user), freeing the sales point.
    - The daily report logs the final values for that sales instance.
  - If configured, self‑ordering flows may also automatically close orders and sales instances when payment is completed by the customer.
  - For self‑ordering (and for delivery when implemented), the system also sends a confirmation **email** and **in-app notification** with the receipt so the customer can show proof of payment when collecting the order.

---

## 4. Purchasing and incoming stock (manager / purchaser)

- **Recording purchases**
  - When the business receives stock from a supplier, a designated employee creates a **Purchase**:
    - Selects the **Supplier**, date, and optionally the responsible employee.
    - Adds **purchase lines**: each line references a **Supplier good**, quantity, and unit price.
    - Each line reflects one item on the supplier’s receipt/invoice.
  - For each purchase line:
    - The system **increases** the current month’s open **Inventory** `dynamicSystemCount` for that supplier good by the purchased quantity (in the good’s measurement unit).
    - The cost information is updated (affects recipe costing, `pricePerMeasurementUnit`, and COGS calculations).
  - One purchase represents **one receipt**; a unique `receiptId` is enforced per supplier and business to avoid duplicates.

- **Editing purchase details**
  - Users can:
    - Add more lines if the receipt is incomplete.
    - **Edit** quantities or prices if there were mistakes — **manager-only** (same roles as closing the daily report); the editor must provide a **reason**. The system records who edited, when, the reason, **and the previous quantity and price (re‑edit data)** on the line for audit, similar to inventory physical-count re-edits.
    - Remove lines that were added in error.
  - The system keeps inventory in sync:
    - Adding a line **increments** stock for that supplier good.
    - Deleting a line **decrements** stock for that supplier good.
    - Editing a line adjusts stock by the **difference** in quantity (up or down).

- **One‑time purchases**
  - For ad‑hoc or rarely purchased items, staff can use a **one‑time purchase** flow:
    - Record a purchase even if there is no proper supplier good configured.
    - The system internally uses a special **“One Time Purchase” supplier** so the receipt is stored.
    - **Inventory is not updated** for one‑time purchases, because there are no real supplier‑good items to track; this keeps inventory consistent while still recording the expense.

---

## 5. Inventory management (manager / inventory staff)

- **Monthly inventory creation**
  - At the start of a month (or configured date), the system creates an **Inventory** for each business:
    - One inventory per **month** and **business**.
  - This inventory tracks:
    - The **dynamic system count** per supplier good (from purchases and orders).
    - **Physical count events** performed by staff.

- **Dynamic inventory during the month**
  - Throughout the month:
    - **Purchases** add to stock for their supplier goods.
    - **Orders** (via business goods recipes) subtract from stock.
    - **Cancellations** restore stock.
  - New supplier goods that start being used are automatically added to the open inventory; goods no longer used are removed.

- **Physical counts and corrections**
  - Inventory staff performs **physical counts** periodically or at month end:
    - For each supplier good, they record the **actual quantity on hand**.
    - The system logs who counted, when, and any **deviation** between system count and physical count.
  - **Re‑editing** a count is restricted to **managers or supervisors**; the request must include a **reason**. The system verifies that the user performing the re‑edit is a manager or supervisor using the current session (no employee ID in the request body). Each re‑edit is tracked (who, when, reason, original values), and deviations are updated.
  - These deviations feed into:
    - **Waste analysis** (linked to budget impact levels).
    - Preparation for monthly reporting and KPIs.

- **Closing the monthly inventory**
  - Once counts and corrections are complete:
    - A **manager** (same roles as closing the daily report) **closes** the inventory for that month. The system **automatically creates the next period’s inventory** in the same action, so the next month is ready for counts and stock updates.
  - From this point:
    - Stock levels become the baseline for the next period.
    - Deviations and waste metrics are ready to flow into monthly reporting and **supplier‑waste analysis** (by budget‑impact level).

- **Low‑stock alerts and variance report**
  - After orders are created, the system may check the open inventory for items **below par or minimum** and send a **Warning** notification to **managers on duty** listing those items (low‑stock alert).
  - Managers can view a **variance report** for a month: **theoretical usage** (from orders/recipes) vs **actual usage** (opening stock + purchases − closing stock) per supplier good, for analytics and loss control.

---

## 6. Daily reporting and end‑of‑day closure (manager / on‑duty supervisor)

- **Daily sales report lifecycle**
  - A **Daily sales report** is created automatically when the **first sales instance** opens for the day for a business.
  - Throughout the day it accumulates:
    - **Per‑user** metrics in **employeesDailySalesReport** (keyed by **userId**, ref User): sales totals, tips, goods sold/voided/invited, payment method breakdown.
    - **Self‑ordering** in **selfOrderingSalesReport** (keyed by **userId**).
    - **Business‑level** metrics:
      - Total sales, cost of goods (from recipes and inventory), gross margin.
      - Payment methods totals (cash, card types, etc.).
      - Summary of self‑ordering sales.

- **Calculating the daily report**
  - At any point (typically at end of shift/day), a manager can **calculate** or recalculate the daily report:
    - The system aggregates data from **Sales instances** and **Orders** using the shared `dailyReferenceNumber`.
    - It aggregates by **responsibleByUserId** (sales instances) and **createdByUserId** / **createdAsRole** (orders); self-ordering is grouped in **selfOrderingSalesReport** by userId.
  - This gives an up‑to‑date snapshot of performance before final closure.

- **Conditions for closing the day**
  - To **close** the daily sales report:
    - Identity from **session** (userId); the system resolves Employee by userId + businessId and checks an allowed **manager role** (no on-duty requirement).
    - There must be **no open orders** (billingStatus `Open`) for that business and `dailyReferenceNumber`.
  - Once closed:
    - The daily report becomes **locked** for that date.
    - Its data becomes the authoritative source for future **monthly business reporting**.

---

## 7. Weekly and monthly business reporting and KPIs (manager / owner)

- **Weekly business report**
  - Each business can configure the **start day of its reporting week** (e.g. Monday or Sunday) in the Business settings. This is stored on the business document (e.g. `reportingConfig.weeklyReportStartDay`, where 0 = Sunday, 1 = Monday, etc.).
  - For each reporting week and business, the system maintains a **Weekly business report**:
    - Aggregates data from all **calculated/closed** daily sales reports whose days fall into that week (sales, COGS, tips, goods sold/voided/complimentary, payment methods, POS commission).
    - Focuses on **operational performance**; fixed and extra monthly costs are **not** included in the weekly view.
  - Lifecycle:
    - As daily reports are calculated and closed, they continuously feed the current week’s report.
    - When the first sales instance of a new reporting week is opened (which creates a new `dailySalesReport` for that day), the system **automatically aggregates and closes** the **previous** week’s report.
  - Managers receive a **notification** when a weekly report has been aggregated and closed, so they can review that week’s results.

- **Monthly business report**
  - For each business and month, the system maintains a **Monthly business report**:
    - Aggregates data from all **calculated** daily sales reports in the month (sales, COGS, tips, goods sold/voided/complimentary, payment methods, POS commission). The report is refreshed automatically after each **calculate business daily sales report**.
    - Combines this with **inventory** (deviations and waste by supplier‑good budget impact), **purchasing** data, and **labour cost** from **Schedules**, plus **fixed** and **extra** operating costs recorded for that month.
  - The monthly report is designed to show:
    - **Financial summary**:
      - Total sales, cost of goods (COGS), net revenue, gross profit, tips.
      - Void and complimentary values and their percentages.
    - **Cost breakdown**:
      - Food and beverage cost percentages.
      - Labour cost (from schedules and shifts).
      - Fixed and extra operating costs for that month.
    - **Goods analysis**:
      - What goods were sold, voided, or given as invitations.
    - **Supplier waste**:
      - Waste by supplier good budget impact level, derived from inventory variance.
    - **Payment and commission**:
      - Payment method breakdown and any POS commissions.
  - **Targets vs actuals**
    - The monthly report is compared against **business metrics** configured at onboarding:
      - Target food cost %, labour %, fixed cost %, and waste thresholds by budget impact.
    - A persisted `metricsComparison` section stores, per metric, the target, actual, delta, and over/under‑target flags so the UI can highlight where the business is off course.
    - This allows managers and owners to see:
      - Where they are over or under target.
      - Whether the business is at or near **break‑even**.
  - **Closing the month**
    - The system **auto-closes** the monthly business report at the month boundary once all daily reports for that month are closed (no open daily reports in the month).
    - Once closed, it becomes the reference for:
      - Strategic decisions (price changes, promotions, staffing adjustments).
      - Historical comparisons across months.
    - When the system finishes aggregating the full month (e.g. on the first daily calculation of the new month that closes the previous one), managers receive a **notification** that the monthly report for that period is ready to be reviewed.

---

## 8. Notifications and communication (users / employees)

- **Unified communication behavior across flows**
  - Communication is triggered by domain events (orders, reservations, low-stock, weekly/monthly report-ready) through one backend orchestration layer.
  - This keeps messaging consistent in content, recipient targeting, and delivery semantics across the app.
  - At user level, this means the same type of action always produces the same type of notification experience.

- **Customer-facing communication**
  - **Order confirmed (self-order / delivery flow):**
    - Customer receives an **email** receipt/confirmation.
    - Customer also receives an **in-app notification** with the same confirmation context.
  - **Reservation pending:**
    - Customer receives an email + in-app message confirming the request is pending review.
  - **Reservation decided (confirmed/cancelled):**
    - Customer receives the decision by email + in-app notification.

- **Manager-facing communication**
  - **Reservation pending:** managers receive an in-app action-required notification.
  - **Low-stock alert:** managers receive warning notifications for items below threshold.
  - **Weekly and monthly report-ready:** managers receive in-app notifications that the period is ready for review.
  - Manager targeting follows explicit policy (on-duty vs all managers depending on event type), with optional runtime overrides.

- **Persistence-first and live delivery**
  - In-app notifications are persisted first and linked to recipient inbox state; this is the source of truth.
  - If recipients are online, the backend also pushes the notification live over WebSocket.
  - If recipients are offline or disconnected, no message is lost: they still see it in their inbox when they reconnect.

- **Inbox behavior for all users**
  - Each user has a notification inbox with per-notification state:
    - `read` and `deleted` flags.
  - This inbox model is shared for both customer recipients and employee recipients (through user identity).
  - Manual/admin-created notifications and domain-generated notifications converge to the same inbox persistence path.

- **Reliability behavior from user perspective**
  - Core business actions are not blocked by communication failures (fire-and-forget side effects).
  - Email has retry behavior for transient transport failures.
  - Repeated event noise (notably low-stock) is controlled with cooldown and idempotency.
  - Operational telemetry tracks dispatch attempts, channel success/failure, live delivery stats, and auth failures for live connections.

---

## 9. How all roles fit together – simplified scenario

- **Before opening the restaurant**
  - Owner/manager sets up **business**, **employees**, **suppliers**, **supplier goods**, **business goods**, **promotions**, **printers**, **sales points**, and **metrics**.

- **At the start of the day**
  - Employees are **on duty** according to schedules.
  - The first opened **sales instance** creates the **daily sales report**.

- **During service**
  - Waiters/bartenders:
    - Open **sales instances** for tables.
    - Take **orders** (or monitor self‑ordering and delivery) using the configured menu.
    - Manage order lifecycle (send, transfer, cancel, void, complimentary).
    - Receive printed order tickets in kitchen/bar via configured printers.
    - Present bills and collect **payments** and **tips**.
  - Customers:
    - Sit at tables (sales points) or scan **QR codes** for self‑ordering when the business is open according to its configured **businessOpeningHours**.
    - Place delivery orders from home using the **delivery** flow when the business has `acceptsDelivery === true` and is within its configured **deliveryOpeningWindows**.
    - Place orders and, in these flows, pay directly.
  - The system:
    - Updates **inventory** in real time based on orders and purchases.
    - Tracks per‑employee and **delivery** sales, tips, and order actions (delivery attributed to a fixed delivery user id in reports).

- **End of the day**
  - Manager:
    - Ensures there are no unintended open orders.
    - **Calculates** and then **closes** the **daily report**.
  - Daily report becomes the authoritative record of that day’s performance.

- **Over the month**
  - Purchases continue to be recorded; inventory is adjusted accordingly.
  - Staff perform **physical counts** and reconcile deviations.
  - At month end:
    - **Inventories** are closed.
    - The **monthly business report** aggregates daily performance, stock, purchases, and labour to show if the business is on target or not.

This is the high‑level operational flow of the restaurant POS from a user’s perspective, connecting managers, staff, and customers through the same system while keeping stock, costs, and reports in sync.

