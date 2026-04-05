# Business Profile Form + Reusable Unsaved Changes + Reusable Management Notifications

## Goal

Turn `frontend/src/pages/business/BusinessProfileSettingsPage.tsx` (**route:** **`/business/:businessId/settings/profile`**, lazy-loaded from **`appRoutes.tsx`**) into a full editable form for business data, aligned with `backend/src/models/business.ts`, with:

> **Where the frontend services live:** HTTP, React Query hooks, DTO ↔ form mappers, multipart payload builder, and Zod schema are under **`frontend/src/services/business/`** (import the public barrel as **`@/services/business/businessService`**). See **[`frontend/src/services/business/README.md`](frontend/src/services/business/README.md)** for how those modules fit together.

1. Save button at the bottom.
2. Unsaved-changes navigation warning popup (reusable component/hook).
3. On successful save: frontend toast + backend email + in-app notifications to management employees.
4. Notification/email implementation reusable for future domain events.

---

## Mandatory execution rules

These standards are always active and must be applied before and during every checklist item below.

- Read and understand `documentation/context.md` end-to-end before starting execution.
- Keep implementation notes with context constraints (auth/session, routes, business domain, communications).
- Keep code and flow simple; avoid unnecessary abstractions and premature generalization.
- Keep behavior robust and reliable with deterministic state transitions, defensive error handling, and explicit loading/error states.
- All source code creation or execution must include concise, useful comments for flow, logic, and pattern decisions so developers can quickly understand and optimize work.
- Every created or updated file must have relevant tests executed (and passing) before moving to the next task.
- Follow professional React patterns:
  - single source of truth for form state (`react-hook-form`)
  - side effects isolated in hooks/services
  - TanStack Query for optimized, cache-aware API calls
  - shared cross-layer contracts (frontend/backend API/domain) should live in `packages/interfaces` when reusable
  - when adding/updating shared contracts in `packages/interfaces`, keep existing file names stable (do not rename files)
  - prefer direct module imports; avoid `index.ts` barrel imports that can grow into god files
  - stable typed boundaries and clear mapping helpers
  - reusable hooks/components only for repeated behavior
  - accessibility-first interactions (labels, keyboard, focus, aria)
  - keep form UX patterns consistent with `LoginPage.tsx`, `SignUpPage.tsx`, and `BusinessRegisterPage.tsx`
- Prefer incremental, testable changes over large rewrites.

---

## Execution flow (reorganized)

### Phase 0 - Discovery, requirements lock, and contracts

- [x] **0.1 Context and constraints lock**
  - [x] Read `documentation/context.md` and capture constraints that directly affect this feature.
  - [x] Validate auth/session behavior for profile fetch + save + post-save session updates.
  - [x] Confirm route-level authorization expectations for business profile access.
  - Notes:
    - `documentation/context.md` confirms this domain is multi-tenant by `businessId`, with strict auth/session boundaries and no overcomplicated flows.
    - Session behavior expectation is aligned with backend patch flow: authenticated business update returns refreshed `accessToken` + `user` session payload.
    - `PATCH /api/v1/business/:businessId` is already protected by auth + business/session match hooks.
    - `GET /api/v1/business/:businessId` currently has no auth guard; for profile page usage, expected behavior should be authenticated + business/session match. Keep this as a required action in `0.3`.

- [x] **0.2 Business field scope lock (based on model + your decisions)**
  - [x] Classify `Business` model fields as:
    - [x] editable now
    - [x] non-editable/system-managed
  - [x] Keep `subscription` editable and place it at the top of the page.
  - [x] Define subscription UI as 4 selectable cards (`Free`, `Basic`, `Premium`, `Enterprise`) with short descriptions and clear selected state.
  - [x] **Superseded:** credentials were originally an expandable block on the profile page; **current product** uses a dedicated route **`/business/:businessId/settings/credentials`** (**`BusinessCredentialsSettingsPage`**) for sign-in email (with confirm), new password (with confirm), and **current password** (only on that page among business settings). The profile page keeps a single **email** field; **`confirmEmail`** stays in sync on change for full-form Zod on save.
  - [x] For credentials (credentials settings page + shared PATCH):
    - [x] email change requires confirm email field (two visible fields on credentials page; profile syncs hidden confirm for schema)
    - [x] password change requires confirm password field; **current password** required when setting a new password
    - [x] use shared email validation utility from `packages/utils/emailRegex.ts`
    - [x] on successful email/password change, force logout and require new login
  - [x] Define image UX requirements:
    - [x] rounded profile image area near top (after subscription section)
    - [x] fallback icon if no image
    - [x] hover overlay ("Change image") with click-to-upload behavior
    - [x] Cloudinary path stays backend-managed through existing endpoints
  - Scope lock notes:
    - Editable now (profile + split settings): same multipart form model across **`BusinessProfileSettingsPage`**, **`BusinessCredentialsSettingsPage`**, **`BusinessAddressSettingsPage`**, etc. **Password / current password / confirm password** are edited only on **`BusinessCredentialsSettingsPage`**; profile page edits **`email`** only (with **`confirmEmail`** mirrored for validation). Fields: `subscription`, `imageUrl` (via upload), `tradeName`, `legalName`, `email`, `password` (credentials route), `phoneNumber`, `taxNumber`, `currencyTrade`, `address`, `metrics`, `contactPerson`, `cuisineType`, `categories`, `acceptsDelivery`, `deliveryRadius`, `minOrder`, `businessOpeningHours`, `deliveryOpeningWindows`, `reportingConfig.weeklyReportStartDay`.
    - Non-editable/system-managed on this page: `_id`, `createdAt`, `updatedAt`, and rating cache fields (`averageRating`, `ratingCount`) because they are computed by the ratings domain.
    - Credential-change policy locked: if `email` or `password` changes successfully, clear session and force re-authentication.
    - Data-source note: `subscription` options are fixed to `subscriptionEnums` in `packages/enums.ts`.

- [x] **0.3 Backend API contract lock**
  - [x] Confirm `PATCH /api/v1/business/:businessId` multipart requirements and required fields.
  - [x] Confirm `GET /api/v1/business/:businessId` auth guard behavior; if missing, create backend task to add it.
  - [x] Confirm nested JSON multipart fields (`address`, `metrics`, `businessOpeningHours`, `deliveryOpeningWindows`).
  - [x] Confirm update response shape and token/session refresh expectations after patch.
  - Contract lock notes:
    - `PATCH /api/v1/business/:businessId` requires `multipart/form-data`; required fields are `tradeName`, `legalName`, `email`, `phoneNumber`, `taxNumber`, `subscription`, `currencyTrade`, and `address`.
    - `PATCH` auth/authorization is already correct: valid ObjectId + bearer auth + `requireBusinessIdMatchesSessionHook`.
    - `GET /api/v1/business/:businessId` is currently unauthenticated in backend; for profile usage this is a gap and must be tightened to authenticated business/session ownership.
    - **Source audit:** as of implementation review, `GET /:businessId` in `backend/src/routes/v1/business.ts` still has **no** `preValidation` auth hooks (public read by id). Treat as a **remaining hardening task**, not closed by Phase 5–6.
    - Confirmed nested JSON multipart parsing currently implemented for: `address`, `metrics`, `businessOpeningHours`, `deliveryOpeningWindows`.
    - Update response contract is confirmed: `200` with `{ message, accessToken, user }`, and backend resets refresh cookie through session issuance; frontend should sync token/session accordingly.
    - Contract gap to include in implementation: `reportingConfig` is part of model scope but is not currently parsed/updated in `PATCH`; backend patch contract must be extended before frontend persists this field.
    - **Source audit:** `PATCH` handler in the same file still does **not** read a `reportingConfig` multipart field; the profile UI collects `weeklyReportStartDay` and the client may send it, but the route never merges it into `updateBusinessObj` until backend support is added.

- [x] **0.4 Unsaved changes behavior lock**
  - [x] Warn on internal navigation (router links/history) and browser unload.
  - [x] Do not warn when pristine, submitting, or post-save clean state.
  - [x] Confirm modal actions and copy: `Stay` and `Leave`.
  - Behavior lock notes:
    - Trigger conditions:
      - in-app navigation attempt to another route while form is dirty
      - browser refresh/tab close/back-forward unload while form is dirty
    - No-warning conditions:
      - form is pristine (`isDirty === false`)
      - submit is in progress
      - save succeeded and form baseline was reset to clean state
      - intentional programmatic navigation immediately after successful save/logout flow
    - Modal contract:
      - title: `Unsaved changes`
      - body: `You have unsaved changes. If you leave now, your changes will be lost.`
      - actions: `Stay` (close modal, keep current page) and `Leave` (continue pending navigation)
    - Browser unload contract:
      - use native `beforeunload` guard only while dirty; no custom modal text (browser-controlled)
    - Implementation direction (kept simple/reliable):
      - central reusable hook + reusable dialog; page only provides `isDirty`, `isSubmitting`, and success bypass signal.

- [x] **0.5 Rule compliance gate**
  - [x] Verify all Phase 0 outputs follow mandatory rules and avoid overengineering.
  - Compliance notes:
    - Context-first rule satisfied (`documentation/context.md` reviewed and constraints recorded in `0.1`).
    - Simplicity rule satisfied (scope and contracts are locked with direct, minimal implementation direction; no extra layers introduced in planning).
    - Reliability rule satisfied (auth/session boundaries, required fields, and unsaved-change behavior are explicitly defined).
    - React/professional patterns rule satisfied at planning level (RHF single source of truth, hook/service separation, TanStack Query usage, consistent form UX guidance).
    - Open gaps are captured as explicit follow-up contract tasks (auth guard for business GET and `reportingConfig` patch support), not hidden assumptions.

---

### Phase 1 - Frontend data foundation (services, types, validation)

- [x] **1.1 Service layer**
  - [x] Add/extend service methods:
    - [x] `getBusinessById(businessId)`
    - [x] `updateBusinessProfile(businessId, formData)`
  - [x] Keep multipart config consistent (remove manual `Content-Type` for `FormData`).
  - [x] Surface backend errors (`400/401/403/409`) in user-friendly, typed form.
  - [x] Align session/access token updates with auth store behavior when backend returns auth payload.
  - Implementation notes:
    - Added `BusinessServiceError` with HTTP status for typed error handling in fetch/update/create flows.
    - Added `useBusinessProfileQuery` and `useUpdateBusinessProfileMutation` using TanStack Query.
    - Added `queryKeys.business.detail(businessId)` for stable profile cache keys.
    - Update API now syncs returned access token through `setAccessToken` and validates `user.type === "business"` when session payload is present.

- [x] **1.2 Form model and mappers**
  - [x] Define `BusinessProfileFormValues` for full page data model.
  - [x] Add `businessDtoToFormValues` mapper.
  - [x] Add `formValuesToUpdatePayload` mapper with JSON stringification for nested fields.
  - [x] Keep normalization deterministic (trim strings, numeric conversion rules, empty-to-undefined policy).
  - Implementation notes:
    - Added typed form model and nested supporting types in `frontend/src/services/business/businessService.ts` (barrel).
    - Added deterministic mapper `businessDtoToFormValues(dto)` with explicit defaults (including metrics defaults and normalized array fields).
    - Added deterministic mapper `formValuesToUpdatePayload(values)` that emits backend-compatible multipart payload and stringifies nested JSON fields.
    - Mapping helpers normalize trims, optional text handling, numeric coercion/defaults, and category normalization consistently.

- [x] **1.3 Validation schema**
  - [x] Build Zod schema for profile form, including credentials subsection.
  - [x] Enforce backend parity rules (required fields, numeric ranges, enum values).
  - [x] Add profile-specific validations:
    - [x] confirm email match
    - [x] confirm password match + password policy
    - [x] time windows/day-of-week validity
  - [x] Add unit tests for mappers + schema.
  - Implementation notes:
    - Added `frontend/src/services/business/businessProfileFormSchema.ts` with `buildBusinessProfileSchema(...)`.
    - Schema enforces backend-parity required fields and enums (`subscription`, `currencyTrade`), non-negative numeric constraints, and structured nested objects.
    - Credentials validations included: confirm email match, optional password change with confirm password match, and password policy check.
    - Time/dow validations included for opening hours and delivery windows (`HH:MM`, dayOfWeek 0..6, closeTime after openTime).
    - Added mapper+schema unit tests in `frontend/src/services/business/businessProfileFormSchema.test.ts`.

- [x] **1.4 Rule compliance gate**
  - [x] Validate consistency with existing app form patterns and TanStack Query best practices.
  - Compliance notes:
    - Form foundation matches project standards: `react-hook-form` + `zod` schema builder pattern and backend-parity validation constraints are in place **in `frontend/src/services/business/businessProfileFormSchema.ts` (unit-tested)**.
    - **Source audit:** `BusinessProfileSettingsPage.tsx` currently uses `useForm({ defaultValues })` **without** `zodResolver(buildBusinessProfileSchema(...))`. Client-side submit blocking for schema rules is therefore **not** active on the page; invalid shapes are rejected primarily by the **backend** and surfaced via `BusinessServiceError` / `Alert` (see Phase 6.3). Wiring the resolver into the page remains optional UX hardening.
    - Data access follows TanStack usage already established in the app: stable query keys, dedicated query/mutation hooks, and side effects isolated to service layer.
    - Multipart handling is consistent and robust (no forced JSON `Content-Type` for `FormData` requests).
    - Shared vs local types now follow contract discipline:
      - shared API/domain contracts are in `packages/interfaces`
      - UI/form-only contracts remain local to frontend feature/service files
      - no barrel `index.ts` import centralization
    - Phase 1 gate status: passed for **services + schema + tests**; page-level Zod resolver integration deferred as noted above.

---

### Phase 2 - TanStack high-load robustness baseline

- [x] **2.1 QueryClient defaults and request policy**
  - [x] Review and tune global `QueryClient` defaults for busy-time behavior:
    - [x] `staleTime`, `gcTime`, refetch-on-focus/reconnect policy
    - [x] retry policy based on status class (avoid blind retries on `4xx`)
    - [x] predictable error boundary behavior for queries/mutations
  - [x] Document baseline defaults in service docs and keep them consistent across new hooks.
  - Implementation notes:
    - Tuned `frontend/src/services/queryClient.ts` defaults for high-load behavior:
      - `staleTime = 60s`, `gcTime = 10min`
      - `refetchOnWindowFocus = false`, `refetchOnReconnect = true`
      - status-aware retry policy (network/`408`/`429`/`5xx` only) with bounded retries and backoff
      - `throwOnError = false` for explicit screen-level handling
    - Added service-level policy comments in `queryClient.ts`.
    - Documented TanStack baseline defaults in `documentation/frontend-third-party-libraries.md`.

- [x] **2.2 Shared request/error normalization**
  - [x] Standardize service-layer error mapping (`BusinessServiceError` pattern) for all new business profile calls.
  - [x] Ensure network/auth/conflict errors are handled deterministically and exposed with actionable messages.
  - [x] Ensure all profile queries/mutations use stable `queryKeys` and avoid ad-hoc key shapes.
  - Implementation notes:
    - Added shared service error utility `frontend/src/services/serviceErrors.ts` with:
      - `ServiceRequestError`
      - `toServiceRequestError(...)` status-aware normalization for axios/network errors
    - Refactored the business service layer (`frontend/src/services/business/businessProfileApi.ts` + barrel) to use shared normalization while keeping `BusinessServiceError` as feature-specific error type.
    - Refactored `authMode.ts` and `schedulesService.ts` to use shared error normalization and deterministic status-message mapping.
    - Added stable fallback keys in `queryKeys.ts` (`business.detailPending`, `schedules.employeeDayPending`) and replaced ad-hoc inline pending keys in service hooks.

- [x] **2.3 Concurrency control and request shaping**
  - [x] Define and enforce rules for high-frequency requests:
    - [x] debounce user-driven filter/search requests where applicable
    - [x] avoid unbounded parallel `useQueries` bursts
    - [x] cancel stale requests on rapid input/navigation changes
  - [x] Define profile-page specific policy (single-entity screen):
    - [x] one primary detail query
    - [x] one save mutation at a time
    - [x] explicit duplicate-submit prevention
  - Implementation notes:
    - Added query cancellation support (`AbortSignal`) to service query functions:
      - `getBusinessById(...)`
      - `fetchDailyEmployeeSchedule(...)`
      - `getAuthMode(...)`
      and wired `signal` from TanStack query functions.
    - Enforced single-flight profile saves in `updateBusinessProfile(...)` using an in-flight map keyed by `businessId` to prevent duplicate concurrent submissions.
    - Kept one-primary-query policy in profile data hook (`useBusinessProfileQuery`) and stable key usage via `queryKeys.business.detail(...)`.
    - Documented request shaping/busy-time rules (including debounce guidance for filter/search screens) in `documentation/frontend-third-party-libraries.md`.

- [x] **2.4 Mutation reliability and idempotency**
  - [x] Ensure profile save flow is safe under rapid repeated clicks/retries.
  - [x] Define idempotency approach for backend-triggered side effects (notifications/emails) so one logical save emits one event.
  - [x] Separate critical path (profile persistence) from non-critical side effects (communications fail-soft).
  - Implementation notes:
    - Profile save already runs as single-flight per `businessId` in `updateBusinessProfile(...)`, preventing duplicate concurrent PATCH requests from repeated clicks.
    - Added client operation id propagation on profile save (`X-Idempotency-Key` and `X-Correlation-Id` headers) to provide a stable id for backend idempotent side-effect dispatch.
    - Contract for backend phase:
      - persistence (`PATCH /business/:businessId`) remains critical path
      - communications are non-critical and fail-soft
      - side-effect dispatch should use idempotency key to guarantee one logical save => one emitted event.

- [x] **2.5 Observability and load diagnostics**
  - [x] Add minimal diagnostics guidance for this feature:
    - [x] track save error classes (`400/401/403/409/5xx`)
    - [x] track retries/failures and latency for profile fetch/save
    - [x] include correlation/idempotency identifiers for backend dispatch debugging
  - [x] Add a short runbook note for busy-time triage (what to inspect first).
  - Implementation notes:
    - Added lightweight structured diagnostics events in `frontend/src/services/business/businessProfileApi.ts` for profile fetch/save outcomes (`success`, `error`, `coalesced`) with `businessId`, `durationMs`, `status`, and `operationId` context.
    - Save diagnostics and request headers now share the same operation identifier (`X-Idempotency-Key` + `X-Correlation-Id`) for deterministic backend dispatch tracing.
    - Added/updated tests in `frontend/src/services/business/businessService.test.ts` validating idempotency headers and single-flight request coalescing behavior under concurrent save attempts.
    - Added runbook guidance in `documentation/frontend-third-party-libraries.md` (section `4.3`) covering first-line busy-time triage checks and status-class interpretation.

- [x] **2.6 Rule compliance gate**
  - [x] Confirm robustness baseline adds reliability without introducing a generic mega-hook or overengineering.
  - Compliance notes:
    - Reliability was improved through focused, composable service-layer changes (`queryClient` retry policy, shared `serviceErrors`, request cancellation, single-flight saves, idempotency/correlation headers, and minimal diagnostics) instead of introducing one catch-all network hook.
    - Existing TanStack Query primitives (`useQuery`, `useMutation`, shared `queryKey`s, `signal`) remain the main abstraction; no parallel custom framework was added.
    - Changes were incremental and scoped to concrete business/auth/schedule services, preserving clarity and reducing regression surface.
    - Observability stays lightweight (structured diagnostics per fetch/save outcome) and avoids a heavy custom telemetry layer.
    - Rule check: robustness baseline is stronger under load while keeping architecture simple, explicit, and maintainable.

---

### Phase 3 - Business profile UI implementation

- [x] **3.1 Page scaffold and data loading**
  - [x] Replace placeholder in `BusinessProfileSettingsPage.tsx` with real form page.
  - [x] Fetch business by route param and initialize `react-hook-form` defaults from query data.
  - [x] Add explicit loading, error, retry states.
  - Implementation notes:
    - `BusinessProfileSettingsPage.tsx` now uses `useParams` + `useBusinessProfileQuery` to fetch profile data for the route business id and hydrate RHF via `reset(businessDtoToFormValues(data))`.
    - Added explicit render states for invalid route id, loading, error (with retry action), and empty/no-data response.
    - Added initial form scaffold fields (trade/legal name, email, phone, tax, currency, country/city) to establish query-to-form wiring before section expansion tasks.
    - Added page tests in `frontend/src/pages/business/BusinessProfileSettingsPage.test.tsx` covering loading/error+retry states and successful default-value hydration.
    - Loading UI: `loadingSlot` skeleton structure mirrors the loaded core profile section (see `documentation/context.md` §13 and `frontend/src/services/business/README.md`).

- [x] **3.2 Section layout (top-to-bottom as defined)**
  - [x] Subscription card selector at top.
  - [x] Rounded image block with fallback icon + hover overlay + upload interaction.
  - [x] Core business info section.
  - [x] Address section.
  - [x] Discovery/delivery section.
  - [x] Metrics section.
  - [x] Opening hours and delivery windows section.
  - [x] **Superseded:** expandable credentials on profile → replaced by **`BusinessCredentialsSettingsPage`** (account menu → Credentials); profile layout no longer includes that toggle.
  - Implementation notes:
    - Expanded `BusinessProfileSettingsPage.tsx` into the full phase layout sequence while preserving the existing query->RHF hydration flow from task `3.1`.
    - Added interactive subscription cards bound to `subscription`, image avatar upload interaction (`imageFile` + hover overlay), and full grouped sections for core info, address, discovery/delivery, and metrics.
    - Added dynamic `useFieldArray` UI for `businessOpeningHours` and `deliveryOpeningWindows` (including nested delivery windows per day) to align with backend model structure.
    - **Follow-up:** credentials UI moved to `BusinessCredentialsSettingsPage.tsx` (two-column email / new-password stacks, full-width current password); Zod resolver on **`useBusinessProfileSettingsController`**; see `documentation/context.md` *Business credentials settings*.
    - Page tests: profile tests cover core sections; credentials flow is covered by schema tests and credentials page tests as applicable.

- [x] **3.3 Save controls and submit flow**
  - [x] Add bottom save area with `Save changes` (+ optional reset).
  - [x] Disable save when pristine/submitting.
  - [x] On successful save:
    - [x] reset form dirty baseline
    - [x] show success toast
    - [x] force logout when email/password changed
  - [x] On failed save:
    - [x] preserve edits
    - [x] show clear error feedback
  - Implementation notes:
    - Wired `BusinessProfileSettingsPage.tsx` submit flow to `useUpdateBusinessProfileMutation` + `formValuesToUpdatePayload` and added `Save changes`/`Reset changes` controls at page bottom.
    - Save/reset buttons are now disabled while pristine or while mutation is pending (`isDirty` + `isPending` guards).
    - On save success, page refetches profile and resets RHF baseline to canonical server data (including refreshed cloud image URL), then shows success toast.
    - If email or password changed, save success triggers forced logout (`logout`, token clear, `AUTH_CLEAR`, navigate `/login`) with explicit toast message.
    - On save failure, form edits are preserved and inline `Alert` plus error toast are shown for clear user feedback.

- [x] **3.4 Rule compliance gate**
  - [x] Validate accessibility, simplicity, and consistency with existing page/form patterns.
  - Compliance notes:
    - Accessibility checks applied to the implemented profile form:
      - all interactive controls keep explicit labels (`Label` + control `id`)
      - subscription selector now exposes radio-group semantics (`role="radiogroup"` + `role="radio"` + `aria-checked`)
      - form exposes pending state through `aria-busy` during save mutations
      - loading/error/retry and submit-error states are explicit and screen-reader friendly via existing `Card`/`Alert` patterns
    - Simplicity check:
      - no additional generic abstraction layer was introduced
      - existing service hooks and mappers are reused (`useBusinessProfileQuery`, `useUpdateBusinessProfileMutation`, `businessDtoToFormValues`, `formValuesToUpdatePayload`)
      - save flow remains straightforward (submit -> mutate -> refetch/reset -> toast/logout if credentials changed)
    - Consistency check:
      - follows current app conventions (`react-hook-form`, shadcn UI primitives, `Alert`/`Button`/`Card`, shared auth logout behavior, sonner toasts)
      - keeps business profile behavior aligned with existing auth/session boundaries and route patterns.

---

### Phase 4 - Reusable unsaved-changes protection

- [x] **4.1 Reusable dialog component**
  - [x] Create shared `UnsavedChangesDialog` component with reusable props.
  - [x] Use existing UI primitives and keep copy configurable.
  - Implementation notes:
    - Added `frontend/src/components/UnsavedChangesDialog.tsx` as a controlled, reusable confirmation dialog using existing project primitives (`radix-ui` dialog primitive + shared `Button` + `cn` utility).
    - Kept copy configurable through props (`title`, `description`, `stayLabel`, `leaveLabel`) so the same component can be reused by other form pages without duplication.
    - Added callback-based actions (`onStay`, `onLeave`) and optional pending state (`isLeaving`) for flow control by parent hooks/components.
    - Added focused unit tests in `frontend/src/components/UnsavedChangesDialog.test.tsx` covering configurable content, callback behavior, and pending-action disabling.

- [x] **4.2 Reusable guard hook**
  - [x] Create `useUnsavedChangesGuard` hook for:
    - [x] `beforeunload` protection
    - [x] router transition blocking
    - [x] dialog open/stay/leave state handling
  - [x] Keep hook generic for reuse across other form pages.
  - Implementation notes:
    - Added `frontend/src/hooks/useUnsavedChangesGuard.ts` with a generic API (`isDirty`, `isSubmitting`, `enabled`) so any form page can reuse it without feature coupling.
    - Hook now provides in-app transition interception for route-link navigation and exposes reusable dialog control state/actions (`isDialogOpen`, `isLeaving`, `stayOnPage`, `leavePage`).
    - Added native `beforeunload` registration while guard is active to protect against browser tab close/refresh.
    - Added focused tests in `frontend/src/hooks/useUnsavedChangesGuard.test.tsx` covering transition blocking, stay/leave flow, and beforeunload listener lifecycle.

- [x] **4.3 Business profile integration + tests**
  - [x] Integrate guard with form dirty/submitting states.
  - [x] Add tests for dirty navigation warnings and post-save bypass.
  - Implementation notes:
    - Integrated `useUnsavedChangesGuard` + `UnsavedChangesDialog` into `BusinessProfileSettingsPage.tsx`, wired to form `isDirty` and mutation pending state so warnings trigger only when unsaved changes are actually at risk.
    - Confirm dialog actions now control blocked navigation (`Stay on page` resets blocker state, `Leave without saving` proceeds navigation).
    - Extended `BusinessProfileSettingsPage.test.tsx` with route-transition tests covering:
      - dirty-form navigation warning with explicit stay/leave behavior
      - clean navigation after successful save baseline reset (no warning dialog).

- [x] **4.4 Rule compliance gate**
  - [x] Ensure reuse without unnecessary abstraction.
  - Compliance notes:
    - Reuse target is met with exactly two focused building blocks: `UnsavedChangesDialog` (UI) and `useUnsavedChangesGuard` (behavior), both page-agnostic and configurable.
    - No extra framework layer was introduced (no global navigation manager, no feature registry, no tightly coupled business-specific wrapper).
    - Integration in `BusinessProfileSettingsPage.tsx` remains explicit and readable (`isDirty`/`isSubmitting` -> guard state -> dialog actions), minimizing hidden control flow.
    - Existing project patterns are preserved (`react-hook-form`, shared UI primitives, localized feature wiring), so other forms can adopt the same pair incrementally.

---

### Phase 5 - Reusable management notifications and email (backend)

- [x] **5.1 Extend communications contract**
  - [x] Add `BUSINESS_PROFILE_UPDATED` event to `backend/src/communications/types.ts`.
  - [x] Define payload (businessId, actor, changed fields summary, timestamp/context).
  - Implementation notes:
    - Extended `CommunicationsEventName` and `CommunicationsEventPayloadMap` in `backend/src/communications/types.ts` with `BUSINESS_PROFILE_UPDATED`.
    - Added typed `BusinessProfileUpdatedEventPayload` contract including:
      - `businessId`
      - `actor` metadata (`userId`/`employeeId`/`email`/`role`/`source`)
      - `changedFields` + `changedFieldCount`
      - `occurredAt`
      - optional request/operation context (`correlationId`, `operationId`, request path/method)
    - Added placeholder handler registration in `dispatchEvent.ts` to keep event map exhaustive at compile time; channel dispatch logic remains for Phase `5.3`.
    - Updated communications README event catalog to include `BUSINESS_PROFILE_UPDATED`.

- [x] **5.2 Add reusable templates**
  - [x] Create email + in-app templates for profile updates.
  - [x] Exclude sensitive values (never include raw password/token data).
  - Implementation notes:
    - Added `backend/src/communications/templates/businessProfileUpdatedTemplate.ts` with:
      - `partitionBusinessProfileChangedFields` — strips field paths matching password/token/secret patterns from displayed lists (counts them for a generic notice).
      - `buildBusinessProfileUpdatedInAppMessage` — concise notification body.
      - `buildBusinessProfileUpdatedEmailBody` — multi-section plain text (business id, actor, UTC time, optional correlation id, safe field bullets + sensitive summary line).
    - No secret values are templated (callers must not place them in `changedFields`; sensitive paths are collapsed to a generic line).
    - Tests in `backend/tests/communications/communicationsCore.test.ts` cover partitioning, in-app copy, and email copy.

- [x] **5.3 Dispatch logic**
  - [x] Extend `dispatchEvent.ts` with `BUSINESS_PROFILE_UPDATED` handler.
  - [x] Resolve only management recipients using existing resolver policy.
  - [x] Send both email and in-app notifications with idempotency key strategy.
  - Implementation notes:
    - `dispatchEvent.ts` now handles `BUSINESS_PROFILE_UPDATED` by:
      - resolving managers through `resolveManagersByPolicy` (event-driven policy matrix),
      - sending in-app notifications to manager `employeeIds`,
      - resolving manager user emails and sending email summaries.
    - Added reusable multi-recipient helper (`getUserEmails`) and used reusable templates from `businessProfileUpdatedTemplate.ts`.
    - Idempotency strategy remains centralized in `dispatchEvent(...)` options (`idempotencyKey` + `idempotencyWindowMs`) and applies equally to this new event.
    - Manager policy defaults/overrides now include `BUSINESS_PROFILE_UPDATED` with env key `BUSINESS_PROFILE_UPDATED_MANAGER_POLICY`.

- [x] **5.4 Trigger from business update route**
  - [x] In business patch flow, compute changed fields summary from update object.
  - [x] Dispatch event after successful update (fail-soft, non-blocking).
  - [x] Skip dispatch when no meaningful changes were persisted.
  - Implementation notes:
    - Added `flattenChangedFieldPaths` in `backend/src/routes/v1/business.ts` to derive changed field paths from `updateBusinessObj` (nested objects flattened, arrays treated as a single branch).
    - After successful `Business.findByIdAndUpdate`, route now dispatches `BUSINESS_PROFILE_UPDATED` with:
      - actor metadata from authenticated session,
      - changed field summary/count,
      - operation/correlation context from request headers and route metadata.
    - Dispatch is fail-soft (`fireAndForget` + `.catch` warn log), so update API success is not blocked by communications failures.
    - Dispatch is skipped when no meaningful persisted changes are present (`changedFields.length === 0`).

- [x] **5.5 Backend tests**
  - [x] Add coverage for event trigger, recipients, no-change skip, and channel calls.
  - Implementation notes:
    - Route coverage (`backend/tests/routes/business.test.ts`):
      - verifies profile-update event is triggered after successful patch and reaches manager in-app recipients,
      - verifies no-change patch payload skips profile-update dispatch (no manager notifications created).
    - Dispatcher coverage (`backend/tests/communications/communicationsCore.test.ts`):
      - verifies `BUSINESS_PROFILE_UPDATED` uses both channels when managers exist,
      - verifies channel calls are skipped when no manager recipients are resolved.
    - Existing test matrix now explicitly covers: trigger, recipients, no-change skip, and channel-call behavior for this feature.

- [x] **5.6 Rule compliance gate**
  - [x] Keep implementation event-driven and reusable for future domain updates.
  - Compliance notes:
    - Event-driven boundary is preserved: business route only emits `BUSINESS_PROFILE_UPDATED`; channel orchestration remains centralized in `dispatchEvent.ts`.
    - Reusable composition is preserved: templates (`businessProfileUpdatedTemplate.ts`), recipient policy (`managerRecipientPolicy.ts`), and dispatch options (idempotency/correlation/fire-and-forget) are generic and reusable for future domain events.
    - Security guardrail is preserved: sensitive field paths are sanitized at template level (no credential/token value leakage in notification content).
    - Non-blocking domain flow is preserved: patch success is independent from communications outcomes (fail-soft dispatch with warning log).
    - Regression evidence:
      - `npm run test -- tests/routes/business.test.ts tests/communications/communicationsCore.test.ts tests/communications/standardizedBehaviors.test.ts tests/integration/communicationsDomainFlows.test.ts`
      - Result: 4 files, 45 tests passed (current suite; aligns with Phase 6.4 backend command).

---

### Phase 6 - Integration verification and regression checks

- [x] **6.1 Frontend behavior checks**
  - [x] Verify save success toast, clean dirty state, and credentials-change logout flow.
  - [x] Verify unsaved warning behavior in all navigation paths.
  - Implementation / verification notes:
    - **Save + toast + baseline:** `BusinessProfileSettingsPage.test.tsx` asserts success toast and that the form display matches the refetched DTO after a non-credential save (`tradeName` returns to server value).
    - **Credentials logout:** tests cover forced logout + `AUTH_CLEAR` + `setAccessToken(null)` after **password** change and after **email + confirm email** change.
    - **Unsaved guard:** profile page tests cover **`<Link>`** navigation (dialog, stay, leave, post-save navigation without dialog). Hook tests cover **beforeunload** listener registration when dirty; dialog component tests cover stay/leave callbacks.
    - Regression command: `npm run test -- src/pages/business/BusinessProfileSettingsPage.test.tsx src/hooks/useUnsavedChangesGuard.test.tsx src/components/UnsavedChangesDialog.test.tsx` → 3 files, 24 tests passed.

- [x] **6.2 Communications checks**
  - [x] Verify profile update triggers backend dispatch.
  - [x] Verify manager in-app notifications and manager email delivery.
  - Implementation / verification notes:
    - **Dispatch + in-app (manager):** `business.test.ts` — `dispatches BUSINESS_PROFILE_UPDATED to manager recipients after successful patch` persists a manager-scoped `Notification` with expected content when `COMMUNICATIONS_EMAIL_ENABLED=false`.
    - **No-op skip:** same file — `skips BUSINESS_PROFILE_UPDATED dispatch when patch has no meaningful changes`.
    - **Email path:** same file — `profile PATCH triggers manager email send when email channel is enabled` enables `COMMUNICATIONS_EMAIL_ENABLED`, spies `emailChannel.send`, PATCH changes trade name, asserts email payload (`BUSINESS_PROFILE_UPDATED`, subject, body contains business id).
    - **Dispatcher unit coverage:** `communicationsCore.test.ts` exercises `dispatchEvent("BUSINESS_PROFILE_UPDATED", …)` with `inAppChannel.send` and `emailChannel.send` (mocked).
    - Regression command: `npm run test -- tests/routes/business.test.ts` → 1 file, 20 tests passed.

- [x] **6.3 Error-path checks**
  - [x] Verify validation, conflict, auth, and network failure UX.
  - [x] Verify edits are preserved after failed save.
  - Implementation / verification notes:
    - **Save failure UX:** `BusinessProfileSettingsPage.test.tsx` nested describe `error paths (Phase 6.3)` mocks `mutateAsync` rejections with `BusinessServiceError` for **409** (conflict copy matches `businessService` default), **401**, **403**, and **400** (API validation-style body message). Asserts **inline `Alert`** shows the error message and **`toast.error("Failed to save business profile.")`** fires.
    - **Network-style failure:** rejection with generic `Error("Network request failed")` surfaces `error.message` in the Alert with the same error toast.
    - **Edits preserved:** each case edits a distinct field then asserts the input still holds the user's value after submit (no `reset` on failure — see `onSubmit` `catch` in `BusinessProfileSettingsPage.tsx`).
    - **Load path:** existing tests still cover query **error + Retry** (network/load failure for initial fetch).
    - Regression command: `npm run test -- src/pages/business/BusinessProfileSettingsPage.test.tsx` → 1 file, 17 tests passed.

- [x] **6.4 Regression suite**
  - [x] Run touched frontend tests.
  - [x] Run touched backend tests.
  - [x] Run lint and type-check for modified files.
  - Implementation / verification notes:
    - **Frontend tests**
      - Command: `npm run test -- src/pages/business/BusinessProfileSettingsPage.test.tsx src/hooks/useUnsavedChangesGuard.test.tsx src/components/UnsavedChangesDialog.test.tsx src/services/business/businessProfileFormSchema.test.ts src/services/business/businessService.test.ts`
      - Result: **5 files, 34 tests passed**.
    - **Backend tests**
      - Command: `npm run test -- tests/routes/business.test.ts tests/communications/communicationsCore.test.ts tests/communications/standardizedBehaviors.test.ts tests/integration/communicationsDomainFlows.test.ts`
      - Result: **4 files, 45 tests passed**.
    - **Lint**
      - `npm run lint` (whole frontend) currently reports **3 ESLint errors** in unrelated UI/table files (`button.tsx`, `sidebar.tsx`, `TableConfigManager.tsx`) plus a TanStack Table warning in `useEnhancedTable.ts` — **not introduced by the business profile slice**.
      - Scoped lint on profile-related sources/tests:  
        `npx eslint src/pages/business/BusinessProfileSettingsPage.tsx src/pages/business/BusinessProfileSettingsPage.test.tsx src/services/business/businessService.ts src/services/business/businessService.test.ts src/services/business/businessProfileFormSchema.ts src/services/business/businessProfileFormSchema.test.ts src/services/http.ts src/services/queryClient.ts src/services/queryKeys.ts src/services/serviceErrors.ts src/hooks/useUnsavedChangesGuard.ts src/hooks/useUnsavedChangesGuard.test.tsx src/components/UnsavedChangesDialog.tsx src/components/UnsavedChangesDialog.test.tsx`  
        → **clean exit**.
    - **Type-check**
      - Frontend: `npx tsc -b --noEmit` still fails on **other** tests/modules (e.g. `@/auth` barrel removal in several `*.test.tsx`, `src/services/business/businessService.test.ts` typing). **`BusinessProfileSettingsPage.test.tsx`** fixture was aligned with `IBusinessProfileDto` (optional `deliveryRadius` / `minOrder` — omit instead of `null`) so that file no longer contributes a TS2352 on save.
      - Backend: `npx tsc --noEmit` reports existing issues (`dispatchEvent.ts` recipient typing, `packages/interfaces` extension hints under `NodeNext`) — **outside the Phase 6.4 test commands**, which are green.

---

## Source-level audit (phases executed vs open gaps)

**Executed in source (Phases 1–6):** Profile UI, multipart save, session refresh on update, unsaved-changes dialog + hook, management `BUSINESS_PROFILE_UPDATED` dispatch (in-app + email), route/integration tests, and Phase 6 regression commands are **implemented and covered by tests** as described in Phases 3–6.

**Not fully closed in backend routes (Phase 0.3 contract gaps):**

1. **`GET /api/v1/business/:businessId`** — still **no** auth / session-ownership guard; any caller with the id can read the profile document. Patch flow is protected; **read** is not.
2. **`PATCH` + `reportingConfig`** — profile form includes `reportingConfig.weeklyReportStartDay`, and the client mapper can send `reportingConfig`, but **`backend/src/routes/v1/business.ts` PATCH does not parse or `$set` it**, so that field does not persist until the route is extended.

**Frontend nuance:**

- **Zod** — `frontend/src/services/business/businessProfileFormSchema.ts` and tests exist; **`BusinessProfileSettingsPage` does not use `zodResolver`**, so rich client validation is not enforced on submit (API errors drive failure UX).

**Tooling nuance:**

- Full-repo **`npm run lint`** and workspace **`tsc -b`** may still fail outside the scoped profile paths; see Phase **6.4** for the passing scoped commands.

---

## Suggested file targets (implementation reference)

- Frontend
  - `frontend/src/pages/business/BusinessProfileSettingsPage.tsx`
  - `frontend/src/services/queryClient.ts`
  - `frontend/src/services/queryKeys.ts`
  - `frontend/src/services/http.ts`
  - `frontend/src/services/business/` (barrel `businessService.ts`; see `README.md` in that folder)
  - `frontend/src/services/business/businessProfileFormSchema.ts`
  - `frontend/src/components/UnsavedChangesDialog.tsx`
  - `frontend/src/hooks/useUnsavedChangesGuard.ts`
  - `frontend/src/locales/*`

- Backend
  - `backend/src/routes/v1/business.ts`
  - `backend/src/communications/types.ts`
  - `backend/src/communications/dispatchEvent.ts`
  - `backend/src/communications/templates/*`
  - `backend/src/communications/recipientResolvers/*`

---

## Definition of done

- [x] Business profile page is fully editable for agreed business fields **(UI + PATCH persistence for all fields currently merged by the backend route; see Source-level audit for `reportingConfig` and GET auth)**.
- [x] Subscription appears at top as card selector and is persisted correctly.
- [x] Rounded profile image block supports fallback, hover overlay, and upload.
- [x] Credentials section is toggleable and supports confirm email/password.
- [x] Successful email/password change forces logout and new login.
- [x] Save button persists changes and shows success toast.
- [x] Unsaved changes guard works for route navigation and browser unload and is reusable.
- [x] Successful profile updates trigger reusable backend communications flow.
- [x] Management employees receive in-app notifications and emails (when channels enabled; covered by tests).
- [x] TanStack/service layer is hardened for busy-time traffic (stable query keys, retry policy, no unbounded burst patterns, deterministic error handling).
- [x] Tests and scoped lint pass for touched modules (Phase 6.4); full-repo ESLint / workspace `tsc` may still fail on unrelated files — tracked in 6.4 notes.

**Remaining product/security follow-ups (optional next PRs):**

- [ ] Authenticate and tenant-scope **`GET /api/v1/business/:businessId`** like PATCH (see Source-level audit).
- [ ] Parse and persist **`reportingConfig`** on **`PATCH`** so `weeklyReportStartDay` round-trips (see Source-level audit).
- [ ] Optionally wire **`zodResolver(buildBusinessProfileSchema(...))`** into `BusinessProfileSettingsPage` for earlier client validation.
