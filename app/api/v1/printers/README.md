# Printers API — `app/api/v1/printers`

This folder contains the **REST API for the Printer entity**: physical or network printers that a **Business** uses to print orders (e.g. kitchen, bar, dessert), receipts, or reports. Printers are scoped by `businessId` and can be configured with **which categories and sales points** they print for, and **which employees** are allowed to use them. This document describes how the printer routes work, how they fit into the app, and the patterns to follow when extending or integrating with them.

---

## 1. Purpose and role in the application

- **Printer** = a print destination owned by a business. It has a network identity (`ipAddress`, `port`), a human-readable `printerAlias`, optional `description`, and a **status** (`Online` / `Offline` / etc.) that is **checked automatically** when creating or updating the printer (TCP connection test).
- **Routing orders to printers:** Each printer can have an array of **configuration setups** (`configurationSetupToPrintOrders`). Each setup defines:
  - **What** to print: `mainCategory` (e.g. "Food", "Beverage") and optionally `subCategories` (e.g. "Dessert", "Coffee").
  - **Where** it applies: `salesPointIds` (which tables/areas send orders to this printer).
  - **Who** to exclude: `excludeEmployeeIds` (employees for whom this config does not apply).
- So when an order is created from a given sales point and contains items in a given category, the app can determine **which printer(s)** should receive the ticket (e.g. kitchen printer for Food, bar printer for Beverage).
- **Access control:** `employeesAllowedToPrintDataIds` defines which employees are allowed to print **data** (bills, reports, etc.) from this printer. The design intent is that an employee is allowed to print from **one printer only**; the PATCH duplicate check enforces that no employee appears in more than one printer’s list within the same business.
- **Backup:** Optional `backupPrinterId` points to another printer; if this printer fails, print jobs can fall back to the backup. On DELETE, any printer that had this one as backup has `backupPrinterId` unset in a transaction.

So: **Printers are the business’s print targets; configuration setups and employee allowlists define what gets printed where and by whom.** The routes in this folder are the single source of truth for printer CRUD and for managing configuration setups.

---

## 2. File structure

```
app/api/v1/printers/
├── README.md                    # This file — context for flow, patterns, and app integration
├── route.ts                     # GET all printers | POST create printer
├── [printerId]/
│   └── route.ts                 # GET | PATCH | DELETE by printerId
│   ├── addConfigurationSetupToPrinter/
│   │   └── route.ts             # PATCH — add one configuration setup to the printer
│   ├── editConfigurationSetupFromPrinter/
│   │   └── [configurationSetupToPrintOrdersId]/
│   │       └── route.ts         # PATCH — edit one configuration setup by subdocument ID
│   └── deleteConfigurationSetupFromPrinter/
│       └── [configurationSetupToPrintOrdersId]/
│           └── route.ts         # PATCH — remove one configuration setup by subdocument ID
├── business/
│   └── [businessId]/
│       └── route.ts             # GET all printers for a business
└── utils/
    └── checkPrinterConnection.ts # TCP connection check (ip + port) → Online/Offline
```

- **`route.ts`**: list all printers (with populates) and create a printer (JSON body).
- **`[printerId]/route.ts`**: get one, update, or delete a printer; DELETE uses a transaction to unset `backupPrinterId` on others if this printer was a backup.
- **`business/[businessId]/route.ts`**: list printers for the given business (main way the UI loads “my printers”).
- **`addConfigurationSetupToPrinter`**: append one entry to `configurationSetupToPrintOrders`.
- **`editConfigurationSetupFromPrinter/[configurationSetupToPrintOrdersId]`**: update one entry by its `_id` (subdocument ObjectId).
- **`deleteConfigurationSetupFromPrinter/[configurationSetupToPrintOrdersId]`**: remove one entry by its `_id`.
- **`utils/checkPrinterConnection.ts`**: used on create and PATCH to set `printerStatus` from a quick TCP connection test.

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/printers` | Returns all printers (populated). 404 if none. |
| POST | `/api/v1/printers` | Creates a new printer. Body: **JSON**. Sets `printerStatus` via connection check. |
| GET | `/api/v1/printers/:printerId` | Returns one printer by ID (populated). 404 if not found. |
| PATCH | `/api/v1/printers/:printerId` | Partial update (alias, description, IP, port, backup, employees). Re-checks connection for status. |
| DELETE | `/api/v1/printers/:printerId` | Deletes printer; in same transaction, unsets `backupPrinterId` on any printer that referenced this one. |
| GET | `/api/v1/printers/business/:businessId` | Returns all printers for the business. 404 if none. |
| PATCH | `/api/v1/printers/:printerId/addConfigurationSetupToPrinter` | Adds one configuration setup (mainCategory, subCategories, salesPointIds, excludeEmployeeIds). |
| PATCH | `/api/v1/printers/:printerId/editConfigurationSetupFromPrinter/:configurationSetupToPrintOrdersId` | Updates one configuration setup by subdocument ID. |
| PATCH | `/api/v1/printers/:printerId/deleteConfigurationSetupFromPrinter/:configurationSetupToPrintOrdersId` | Removes one configuration setup by subdocument ID. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404.

---

## 4. Request/response patterns

### 4.1 GET (list all, by ID, by business)

- **List all:** `Printer.find()` with populates: `backupPrinterId`, `employeesAllowedToPrintDataIds`, `configurationSetupToPrintOrders.salesPointIds`, `configurationSetupToPrintOrders.excludeEmployeeIds`. Then `.lean()`.
- **By ID:** `printerId` validated with `isObjectIdValid([printerId])`, then `Printer.findById(printerId)` with same populates and `.lean()`.
- **By business:** `businessId` validated, then `Printer.find({ businessId })` with same populates and `.lean()`. This is the **primary way** the app loads printers for the current business.
- **Response:** 200 + JSON array or single object; 404 when no data or invalid ID.

### 4.2 POST (create) — JSON body

- **Required:** `printerAlias`, `ipAddress`, `port`, `businessId`.
- **Optional:** `description`, `backupPrinterId`, `employeesAllowedToPrintDataIds` (array of ObjectIds).
- **Validation:** `businessId` and, if present, `backupPrinterId` and `employeesAllowedToPrintDataIds` (must be array of valid ObjectIds) validated with `isObjectIdValid`.
- **Uniqueness:** `Printer.findOne({ businessId, $or: [{ printerAlias }, { ipAddress }] })`. If found, return 400 (duplicate alias or IP within business). Schema also has `ipAddress` unique globally.
- **Status:** Before create, `checkPrinterConnection(ipAddress, port)` is called. It opens a TCP socket to `ipAddress:port` with a 1s timeout; on connect → `printerStatus: "Online"`, on error/timeout → `printerStatus: "Offline"`. The new printer is saved with this status.
- **Configuration:** Printer is created **without** `configurationSetupToPrintOrders`; setups are added later via `addConfigurationSetupToPrinter`.

### 4.3 PATCH (update printer) — JSON body

- **Fields:** `printerAlias`, `description`, `ipAddress`, `port`, `backupPrinterId`, `employeesAllowedToPrintDataIds`. All optional in the sense that only provided fields are updated.
- **Validation:** `printerId` and, if present, `backupPrinterId` and `employeesAllowedToPrintDataIds` (array of ObjectIds).
- **Conflict check:** A single query finds another printer in the same business that has either the same `printerAlias`, same `ipAddress`, or **any** of the given `employeesAllowedToPrintDataIds` in its own list. If found, return 400 (duplicate alias/IP or employee already assigned to another printer).
- **Status:** Same as POST — `checkPrinterConnection(ipAddress, port)` and set `printerStatus` to "Online" or "Offline". So every PATCH that touches the printer re-checks connectivity.
- **Update:** Build `updatePrinterObj` with only changed fields plus `printerStatus`; `Printer.findByIdAndUpdate(printerId, { $set: updatePrinterObj }, { new: true, lean: true })`.

### 4.4 Configuration setup routes (add / edit / delete)

- **Add:** Body: `mainCategory` (required), `subCategories` (optional array of strings), `salesPointIds` (required array of ObjectIds), `excludeEmployeeIds` (optional array of ObjectIds). Duplicate check: no other configuration in **this** printer may have the same `mainCategory` and (no subCategories or overlapping `subCategories`). Then `$push` to `configurationSetupToPrintOrders`.
- **Edit:** Params: `printerId`, `configurationSetupToPrintOrdersId` (the subdocument `_id`). Body: same shape as add. Duplicate check: no **other** configuration in this printer (excluding the one being edited) may have the same `mainCategory` and overlapping `subCategories`. Then `$set` on the matching array element (`configurationSetupToPrintOrders.$`).
- **Delete:** Params: `printerId`, `configurationSetupToPrintOrdersId`. Uses `$pull` to remove the subdocument with that `_id`.

`mainCategory` must be one of the app’s `mainCategoriesEnums` (e.g. Food, Beverage, Set Menu, etc.) as defined in the Printer schema.

---

## 5. Connection check and printer status

**`utils/checkPrinterConnection.ts`** uses Node’s `net.Socket` to attempt a TCP connection to `ipAddress:port`:

- Timeout: 1 second.
- On successful connect: socket is destroyed and the function resolves `true` → backend sets `printerStatus: "Online"`.
- On error or timeout: resolves `false` → backend sets `printerStatus: "Offline"`.

So **printer status is not stored from the printer itself**; it is derived from a quick connectivity test at create and update time. For real-time status, the front-end or a background job would need to call an endpoint that runs this check and optionally updates the document.

---

## 6. DELETE printer and backup cleanup

DELETE runs in a **MongoDB transaction**:

1. `Printer.deleteOne({ _id: printerId }, { session })`. If `deletedCount === 0`, abort and return 404.
2. If any other printer has `backupPrinterId: printerId`, run `Printer.updateMany({ backupPrinterId: printerId }, { $unset: { backupPrinterId: "" } }, { session })`.
3. Commit the transaction.

So removing a printer also clears references to it as a backup, keeping data consistent.

---

## 7. Shared utilities and dependencies

Used by the printer routes:

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response for catch blocks. |
| `@/lib/utils/isObjectIdValid` | Validate `printerId`, `businessId`, `backupPrinterId`, array of IDs (employees, sales points, etc.). |
| `./utils/checkPrinterConnection` | TCP check to set `printerStatus` on create/PATCH. |
| `@/lib/interface/IPrinter` | Types for printer and `IConfigurationSetupToPrintOrders`. |
| `@/lib/db/models/printer` | Mongoose model. |
| `@/lib/db/models/employee` | Populate `employeesAllowedToPrintDataIds` and `configurationSetupToPrintOrders.excludeEmployeeIds`. |
| `@/lib/db/models/salesPoint` | Populate `configurationSetupToPrintOrders.salesPointIds`. |

Enums: `printerStatusEnums` and `mainCategoriesEnums` from `@/lib/enums` (used in schema).

---

## 8. How other parts of the app use Printer

### 8.1 Business and multi-tenancy

- Every printer has a required `businessId`. When the **Business** is deleted, all its **Printer** documents are deleted in the same transaction (see `app/api/v1/business/[businessId]/route.ts` DELETE).
- The main way to load “printers for the current business” is **GET** `/api/v1/printers/business/:businessId`.

### 8.2 Orders and print routing

- When orders are created (e.g. from a **SalesInstance** at a **SalesPoint**), the app can use the order’s **main category / subcategory** and **sales point** to decide which printer(s) should receive the ticket. That logic typically runs in the front-end or in an order-processing flow that reads the printer’s `configurationSetupToPrintOrders` and matches order items to `mainCategory` / `subCategories` and `salesPointIds`.
- **Employees** allowed to print data are stored per printer (`employeesAllowedToPrintDataIds`); the UI can restrict “print bill” or “print report” actions to those employees and to a single printer per employee.

### 8.3 Sales points and employees

- **SalesPoint** and **Employee** are referenced inside `configurationSetupToPrintOrders` (salesPointIds, excludeEmployeeIds) and in `employeesAllowedToPrintDataIds`. So printers tie **where** (sales point) and **who** (employee) to **what** (category) for routing and access control.

### 8.4 Flow summary

- **Business** → owns **Printers** (and optionally sets a **backup** printer).
- **Printer** → has **configuration setups** (category + sales points + exclude employees) for order routing, and **employees allowed to print data** for bills/reports.
- **Orders** / **SalesInstance** / **SalesPoint** → drive which printer configs apply when sending tickets or receipts.

So: **any feature that sends something to a printer (order ticket, receipt, report) should use the printer API to resolve which printer(s) to use and whether the current employee is allowed to print.**

---

## 9. Patterns to follow when coding

1. **Always call `connectDb()`** before the first MongoDB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for `printerId`, `businessId`, `backupPrinterId`, and any array of ObjectIds (employees, sales points, configurationSetupToPrintOrdersId).
3. **POST/PATCH printer:** Use **JSON** body (no file upload). Run `checkPrinterConnection(ipAddress, port)` and set `printerStatus` from the result.
4. **Uniqueness:** Within a business, enforce unique `printerAlias` and `ipAddress`; ensure no employee appears in `employeesAllowedToPrintDataIds` of more than one printer.
5. **Configuration setups:** Require `mainCategory` and `salesPointIds`; validate arrays of ObjectIds. Reject duplicate (mainCategory + subCategories) within the same printer on add/edit.
6. **DELETE:** Use a transaction: delete the printer, then unset `backupPrinterId` on any printer that referenced it; commit.
7. **Return consistent JSON:** success 200/201 with relevant body; errors 400/404/500 with clear `message` or `especify`/`Error` from `handleApiError`.

---

## 10. Data model summary (for context)

- **Printer:** `printerAlias`, `description` (optional), `printerStatus` (enum: e.g. Online, Offline, Out of paper, Error), `ipAddress` (unique in schema), `port`, `businessId` (required, ref: Business), `backupPrinterId` (optional, ref: Printer), `employeesAllowedToPrintDataIds` (optional array, ref: Employee), `configurationSetupToPrintOrders` (optional array of subdocuments).
- **ConfigurationSetupToPrintOrders (subdocument):** `mainCategory` (required, from mainCategoriesEnums), `subCategories` (optional string array), `salesPointIds` (required array, ref: SalesPoint), `excludeEmployeeIds` (optional array, ref: Employee). Subdocuments have their own `_id` for edit/delete by ID.

This README is the main context for how the printer API works, how it fits into the app (business, orders, sales points, employees), and how to extend or integrate with it consistently.
