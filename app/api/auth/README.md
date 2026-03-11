# Auth — unified login and session

This folder contains the NextAuth configuration and auth routes. The app uses a **single sign-in form** (email + password) for both business (back-office) and user (person) identities.

## Login flow

1. **Credentials:** NextAuth Credentials provider (`app/api/auth/[...nextauth]/options.ts`) validates email and password:
   - **Business first:** `Business.findOne({ email })`. If found and password matches, return session with `type: "business"`.
   - **Else User:** `User.findOne({ "personalDetails.email": email })`. If found and password matches, return session with `type: "user"`. If the user has `employeeDetails`, the app loads the linked **Employee**, runs **canLogAsEmployee(employeeId)** and adds `employeeId`, `businessId`, `canLogAsEmployee` to the session. For **non-admin employees**, this is a schedule check (today’s shift, 5 minutes before start to end); for employees whose `allEmployeeRoles` includes the **Admin** role, `canLogAsEmployee` is `true` regardless of schedule.

2. **Redirect after sign-in:** Use `callbackUrl=/auth/post-login` so that:
   - **Post-login** (`app/auth/post-login/page.tsx`) reads the session and redirects:
     - `type === "business"` → `/admin`
     - `type === "user"` and no `employeeId` → `/` (customer flow)
     - `type === "user"` and `employeeId` → `/auth/choose-mode`

3. **Mode selection** (users who are also employees): `app/auth/choose-mode/page.tsx` shows “Continue as customer” and “Continue as employee”. The employee option is enabled only when `session.canLogAsEmployee === true`. Choosing a mode calls **POST /api/auth/set-mode** (body `{ mode: "customer" | "employee" }`), which sets a secure cookie `auth_mode` and redirects to `/` or `/admin`.

## Session shape

- **JWT/session** (see `types/next-auth.d.ts`): `user.type` (`"business"` | `"user"`), **`user.id`** (the **userId**), `user.email`. For `type === "user"`: optional `employeeId`, `businessId`, `canLogAsEmployee`.
- **Attribution:** Across the app, “who did it” (open table, create order, close report, etc.) is always derived from **session `user.id`** (userId). APIs do not accept or trust `employeeId` in request bodies for identity; when role or on-duty checks are needed, the server resolves `Employee.findOne({ userId: session.user.id, businessId })`. The optional `employeeId` on the session is used only for **mode selection** (customer vs employee) and UI, not for sending in API request bodies.
- **Mode** for users: stored in cookie `auth_mode` (`customer` | `employee`), read by middleware to allow or deny access to `/admin`.

## Schedule check at login

- **Helper:** `lib/auth/canLogAsEmployee.ts` — given `employeeId`, returns `{ canLogAsEmployee: boolean }`:
  - For **non-admin employees**, it checks today’s schedule for the employee’s business and whether the current time is within any shift (from 5 minutes before start to end, non-vacation).
  - For employees whose `allEmployeeRoles` includes the **Admin** role, it returns `true` regardless of schedule or time window (admins can log in as employee at any time).
- Used inside NextAuth `authorize()` when building the user object so the result is in the session without an extra client call.

## Middleware

- **Protected routes:** `middleware.ts` protects `/admin`. Allows access if session `type === "business"` or if `type === "user"` and cookie `auth_mode === "employee"`. Otherwise redirects to sign-in with `callbackUrl=/auth/post-login` or to `/auth/choose-mode`.

## Files

- `[...nextauth]/options.ts` — NextAuth config: authorize (Business then User), jwt/session/redirect callbacks.
- `[...nextauth]/route.ts` — NextAuth handler.
- `set-mode/route.ts` — POST: set `auth_mode` cookie and redirect.
- `lib/auth/canLogAsEmployee.ts` — schedule check for employee login.
