# Employees API — `app/api/v1/employees`

This folder contains the **REST API for the Employee entity**: staff members who work for a **Business** and operate the POS (open sales instances/tables, place orders, manage inventory/purchases, print tickets/bills, etc.). Employees are scoped by `businessId` and are **linked to a `User` account** via `userId` / `user.employeeDetails`.

This document explains how the employee routes work, how they fit into the app, the patterns they follow (validation, transactions, Cloudinary uploads), and why employees are a central building block for the entire POS flow.

---

## 1. Purpose and role in the application

- **Employee** = a business staff record with roles, HR/contract info, and operational flags.\n  It contains:
  - `allEmployeeRoles` (multiple roles per employee)
  - `active` / `onDuty` (operational status)
  - `joinDate`, `terminatedDate`, `vacationDaysPerYear`, `vacationDaysLeft`
  - optional salary info (`salary.payFrequency`, `grossSalary`, `netSalary`)
  - `documentsUrl` (Cloudinary URLs for documents)
- **Business-scoped identity:** Employees belong to exactly one business through `businessId`.
- **User linkage:** Employees are connected to a `User` record through:
  - `Employee.userId` (required)
  - `User.employeeDetails` (optional pointer back to Employee)
  Employee creation and updates intentionally keep this mapping consistent using transactions.
- **Operational coupling across the app:** Employees are the business-scoped “who” for roles and schedules. **Attribution** (who opened a table, who created an order, who is on the daily report) is stored as **userId** (ref User) everywhere—sales instances use **openedByUserId**, **responsibleByUserId**, **closedByUserId**; orders use **createdByUserId** and **createdAsRole**; daily reports use **userId** in employeesDailySalesReport and selfOrderingSalesReport. APIs do not accept employeeId in request bodies for “who am I”; identity comes from session (userId). When role or on-duty checks are needed (e.g. close daily report), the server resolves Employee by `Employee.findOne({ userId, businessId })`.
  - **Reporting**: daily sales reports track users (by userId) who participated
  - **Printers**: printers can allow/exclude employees for printing
  - **Schedules/shift management**: employees are scheduled and their duty status affects UI/operations. At **login**, if a user has `employeeDetails`, the app runs `canLogAsEmployee(employeeId)` to decide whether the user can continue as employee and to set `canLogAsEmployee` in the session. For **non-admin employees**, this is a schedule check (today's shift, from 5 minutes before start to end); employees whose `allEmployeeRoles` includes the **Admin** role can log in as employee at any time (no schedule required).

So: **Employees are the “who” behind most business operations in the POS.** This folder is the source of truth for creating, updating, and managing employees and their linkage to users and printers. Create, update, and delete operations keep **User.employeeDetails** in sync (see users README).

---

## 2. File structure

```
app/api/v1/employees/
├── README.md                               # This file — context for flow, patterns, and app integration
├── route.ts                                # GET all employees | POST create employee
├── [employeeId]/
│   └── route.ts                            # GET | PATCH | DELETE by employeeId
├── business/
│   └── [businessId]/
│       └── route.ts                        # GET all employees for a business
└── utils/
    └── calculateVacationProportional.ts    # Helper: calculate vacationDaysLeft based on joinDate
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/employees` | Returns all employees (no business filter). 404 if none. |
| POST | `/api/v1/employees` | Creates a new employee **and links it to a User**. Body: **FormData**. Transactional. |
| GET | `/api/v1/employees/:employeeId` | Returns one employee by ID. 404 if not found. |
| PATCH | `/api/v1/employees/:employeeId` | Updates employee fields, documents, and can move the employee to a different User. Body: **FormData**. Transactional. |
| DELETE | `/api/v1/employees/:employeeId` | Deletes employee, unlinks from User, removes from printers, deletes Cloudinary folder. Transactional. |
| GET | `/api/v1/employees/business/:businessId` | Returns employees for a business (primary UI query). 404 if none. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns

### 4.1 GET (list all, by ID, by business)

- **DB**: `connectDb()` before the first query.
- **Validation**: `employeeId` / `businessId` validated with `isObjectIdValid([id])`.
- **Querying**:
  - List all: `Employee.find().lean()`
  - By ID: `Employee.findById(employeeId).lean()`
  - By business: `Employee.find({ businessId }).lean()`

### 4.2 POST (create employee) — FormData + transaction

POST uses **FormData** because it can upload employee documents (`documentsUrl`).

**Required fields (FormData):**

- `allEmployeeRoles` (JSON string array)
- `taxNumber`
- `joinDate`
- `vacationDaysPerYear`
- `businessId`
- `userEmail` (used to locate the User record and link `userId`)

**Optional fields:**

- `contractHoursWeek`
- `salary` (JSON string object with keys `payFrequency`, `grossSalary`, `netSalary`)
- `comments`
- `documentsUrl` (multiple files; enforced max total of 10)

**Validation and important logic:**

- `businessId` validated with `isObjectIdValid`.
- `allEmployeeRoles` validated against `userRolesEnums`.
- `salary` validated with `objDefaultValidation` using required keys: `payFrequency`, `grossSalary`, `netSalary`.
- The code opens a MongoDB session and creates the employee inside a transaction because it must also update the user:\n  - Find the `User` by `personalDetails.email === userEmail`.\n  - Reject if the user doesn’t exist.\n  - Reject if an employee already exists for the same `(businessId, userId)`.\n  - Create `Employee`.\n  - Update `User` to set `employeeDetails = employeeId`.\n  - Commit.

**Documents (Cloudinary):**

- If files are provided, they are uploaded to Cloudinary at:\n  `/business/:businessId/employees/:employeeId`\n- The employee stores the returned URLs in `documentsUrl`.

### 4.3 PATCH (update employee) — FormData + transaction

PATCH supports:

- Updating employee fields (roles, taxNumber, joinDate, active, salary, comments, etc.)
- Uploading more documents (enforced max of 10 total across existing + new)
- Moving the employee linkage from one User to another (by changing `userEmail`)
- Removing employee from printers if the employee becomes inactive

Key patterns:

- Validates `employeeId`.
- Validates `allEmployeeRoles` against `userRolesEnums` and salary structure (if provided).
- Loads employee and populates `userId` to compare current `userEmail`.
- Uses `calculateVacationProportional(joinDate, vacationDaysPerYear)` to recompute `vacationDaysLeft` when joinDate or vacationDaysPerYear change.
- If `userEmail` changed:\n  - Unset `employeeDetails` on the old user\n  - Set `employeeDetails` on the new user\n  - Update `Employee.userId`\n  (all in the same transaction)
- If `active === false`, it updates printers for the business to pull this employee out of printer allow/exclude lists.

### 4.4 DELETE (delete employee) — transaction + unlinking

Deletion is discouraged for integrity/historical reasons (business deletion cascade is the normal “hard delete”), but the route exists.

DELETE runs in a transaction because it must:

1. Delete the employee document
2. Remove employee references from printers (`employeesAllowedToPrintDataIds` and configuration excludes)
3. Unset `employeeDetails` in the linked `User`
4. Delete the Cloudinary folder:\n   `/business/:businessId/employees/:employeeId`

---

## 5. Vacation logic (`calculateVacationProportional`)

`utils/calculateVacationProportional.ts` computes how many vacation days remain in the current year:

- If employee joined in the current year: returns the proportional remaining days based on day-of-year.
- If employee joined in a previous year: returns full `vacationDaysPerYear`.
- If joinDate is in the future: returns 0.

This is used during PATCH to keep `vacationDaysLeft` consistent when joinDate or vacationDaysPerYear change.

---

## 6. How other parts of the app use Employee

### 6.1 Business and multi-tenancy

- Every employee has a required `businessId`.
- When the **Business** is deleted, business DELETE cascade deletes `Employee` documents (see `app/api/v1/business/[businessId]/route.ts` DELETE).
- The primary UI query is `GET /api/v1/employees/business/:businessId`.

### 6.2 Sales flow (tables/sales instances and orders)

- **Sales instances** (`app/api/v1/salesInstances`) require a valid `openedByEmployeeId` when employees open a table/session.
- **Orders** (`app/api/v1/orders`) require `employeeId` for employee-driven ordering.
- The daily report creation flow adds employees into the daily sales report when relevant (see `dailySalesReports/utils/addEmployeeToDailySalesReport.ts` used by sales instance creation).

### 6.3 Printing (Printers)

- Printers can reference employees for:\n  - `employeesAllowedToPrintDataIds` (who can print bills/reports)\n  - configuration exclusions
- Employee update/delete proactively removes employees from printer configurations when they become inactive or are deleted.

### 6.4 Scheduling and operations

- Scheduling routes use `Employee` ids to plan shifts and operations.\n- Employee flags `active` and `onDuty` help distinguish current operational staff vs historical/inactive staff.

---

## 7. Shared utilities and dependencies

Used by employee routes:

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response helper. |
| `@/lib/utils/isObjectIdValid` | Validate `employeeId`, `businessId`, and arrays of ObjectIds. |
| `@/lib/utils/objDefaultValidation` | Validate `salary` object keys/values. |
| `@/lib/cloudinary/uploadFilesCloudinary` | Upload employee documents to Cloudinary. |
| `@/lib/cloudinary/deleteFolderCloudinary` | Delete employee Cloudinary folder on delete. |
| `@/lib/enums` | Validate roles against `userRolesEnums`. |
| `@/lib/db/models/employee` | Employee model. |
| `@/lib/db/models/user` | Link/unlink user via `employeeDetails`. |
| `@/lib/db/models/printer` | Remove employees from printer configs when inactive/deleted. |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before DB work.
2. **Validate IDs** with `isObjectIdValid` (employeeId, businessId, arrays).
3. **Use FormData** for create/update because employee documents are file uploads.
4. **Keep User ↔ Employee linkage consistent** using transactions (create employee + set `user.employeeDetails`, or move the link by unsetting old and setting new).
5. **Enforce role enums** (`userRolesEnums`) for `allEmployeeRoles`.
6. **Cap document uploads** and keep Cloudinary folder structure consistent:\n   `/business/:businessId/employees/:employeeId`.
7. **When deactivating/removing employees**, clean up cross-references (printers, future: schedules/assignments) to avoid orphaned operational links.
8. **Return consistent JSON** success/error responses.

---

## 9. Data model summary (for context)

- **Employee** (`lib/db/models/employee.ts`):\n  `allEmployeeRoles[]`, `taxNumber`, `joinDate`, `active`, `onDuty`, `vacationDaysPerYear`, `vacationDaysLeft`, `businessId`, `userId`, optional `currentShiftRole`, optional `contractHoursWeek`, optional `salary`, optional `terminatedDate`, optional `documentsUrl[]`, optional `comments`.\n- **Salary** subdocument: `payFrequency` (enum), `grossSalary`, `netSalary`.

This README is the main context for how the employees API works, how it fits into the app (sales flow, orders, printing, schedules, reporting), and how to extend it consistently.

