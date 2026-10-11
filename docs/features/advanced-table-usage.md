# Advanced Table Guide

This document is the practical source of truth for the advanced table feature in `frontend/src/features/advancedTable`.

It is written for:

- product/users (what the table does),
- developers integrating a new table screen,
- maintainers evolving filtering, fetch behavior, persistence, export, and details modal behavior.

---

## 1) Feature Scope and Mental Model

The advanced table is a reusable table engine with two runtime modes:

- **Local mode**: parent passes `data`; table works fully in-memory.
- **Fetch mode**: parent passes `fetchConfig`; table state drives query params and refetches rows.

Main orchestrator:

- `frontend/src/features/advancedTable/components/StandaloneAdvancedTable.tsx`

Supporting building blocks:

- generic table UI pieces (`TableHeader`, `TableFilterRow`, `TableBody`, `TablePagination`)
- toolbar (`GenericSearchBar`) for date-range and top actions
- details modal (`RecordDetailsModal`)
- hooks/services for table state, filters, fetch, export, and persistence

---

## 2) User-Level Behavior (What End Users Experience)

## 2.1 Table interactions

Users can:

- sort columns by clicking header sort controls,
- filter by input or dropdown filters under the header,
- paginate through rows and adjust page size,
- toggle visible columns from the pagination column menu,
- clear active filters,
- export current filtered result set (when enabled),
- open record details via row interaction and navigate records in modal.

## 2.2 Date-range behavior (business integration)

In the business advanced table integration:

- date range is controlled by URL query params (`start-date`, `end-date`),
- toolbar quick/custom range updates those URL params,
- clear filters resets date range to default quick range,
- URL is shareable/restorable and drives table state.

---

## 3) Module Map (Where Things Live)

`frontend/src/features/advancedTable`

- `components/`
  - `StandaloneAdvancedTable.tsx` (core runtime orchestrator)
  - `GenericSearchBar.tsx` (toolbar + date filter UI)
  - `RecordDetailsModal.tsx` (resizable/details modal)
  - `TableConfigEditor.tsx`, `TableConfigManager.tsx` (table config editing flow)
  - `genericTable/TableHeader.tsx`
  - `genericTable/TableFilterRow.tsx`
  - `genericTable/TableBody.tsx`
  - `genericTable/TablePagination.tsx`
- `hooks/`
  - `useEnhancedTable.ts`
  - `useDynamicTableData.ts`
  - `useTableFilters.ts`
  - `useTableExport.ts`
  - `useColumnPersistence.ts`
  - `useTableConfigData.ts`
- `services/`
  - `fetchService.ts`, `fetchAdapters.ts`
  - `exportService.ts`
  - `persistenceService.ts`
- `types/`
  - `tableContracts.ts`
- `utils/`
  - `dateFilter.ts`
  - `columnStateReconciliation.ts`
  - `columnNormalization.ts`
  - `filterNormalization.ts`
  - `dataMapping.ts`
  - `formatValue.ts`
- `docs/`
  - `date-filter-contract.md`

---

## 4) Core Contracts and Public API

Primary contracts are in:

- `frontend/src/features/advancedTable/types/tableContracts.ts`

Key interfaces:

- `TableColumnConfig<TData>`: column definition (accessor, cell, sorting/filtering/hiding flags, labels).
- `FilterConfig`: per-column filter UI strategy (`input` or `dropdown`) + options.
- `TableFetchParams` / `TableFetchResponse<TData>`: fetch-mode query contract.
- `TableExportOptions`: export file/sheet naming + options.
- `DetailsModalConfig<TData>`: enable/details rendering/navigation behavior.

`StandaloneAdvancedTable` props define all runtime behavior:

- data source: `data` or `fetchConfig`
- rendering: columns, row id, empty states
- behavior: filters, sorting, pagination, realtime filter policy
- extensions: toolbar, export, persistence, details modal, clear/reset hooks
- date range bridge: `dateRangeFilter`, `localOnlyFilterColumnIds`

---

## 5) Runtime Flow (Developer-Level)

## 5.1 Container/Page flow

A page container (example: `frontend/src/components/business/BusinessAdvancedTableSection.tsx`) does:

1. build domain rows/columns/filter configs,
2. own route/session/query-param concerns,
3. provide `fetchConfig` or local `data`,
4. pass toolbar and cross-cutting options into `StandaloneAdvancedTable`.

For date-range integration, the container is responsible for:

- reading URL params via `useSearchParams`,
- validating/healing params,
- writing updated params when toolbar changes.

## 5.2 `StandaloneAdvancedTable` flow

Inside `StandaloneAdvancedTable.tsx`:

1. decide mode (`fetch` vs `local`),
2. compute effective fetch params (inject date params/filters),
3. run fetch hook (fetch mode),
4. compute effective table rows (local mode may apply date-range filtering),
5. initialize persistence and TanStack table state,
6. wire filter hook state and export hook action,
7. render header/filter/body/pagination,
8. manage details modal state and navigation.

Render states:

- loading (fetch mode only),
- error (fetch mode only),
- ready/empty.

---

## 6) Local Mode vs Fetch Mode

Mode rule:

- fetch mode only when `fetchConfig` is provided and `data` is not provided.
- if both are present, local mode is used.

### Local mode

- row source: `data ?? []`
- filtering/sorting/pagination are client-side (TanStack state)
- optional date-range filter is applied in memory (`parseDateTime`-based)

### Fetch mode

- row source: `useDynamicTableData(...)`
- sorting/filters/pagination changes map to outbound fetch params
- date-range is sent via:
  - synthetic filter entries (`start-date`, `end-date`)
  - explicit `startDate`, `endDate` fields

---

## 7) Filtering, Sorting, Pagination

## 7.1 Filtering

`TableFilterRow` renders controls from `FilterConfig`:

- `input` filters (realtime or Enter-to-apply),
- `dropdown` multi-select filters with select-all.

`useTableFilters` responsibilities:

- maintain input buffer state,
- maintain dropdown open/selection state,
- apply normalized values to TanStack column filters,
- clear filters and remove hidden-column filter leftovers.

`useEnhancedTable` uses `includesString` for consistent text filtering behavior.

## 7.2 Sorting

`TableHeader` toggles sort state through TanStack column APIs.
Sort state is propagated to fetch params in fetch mode.

## 7.3 Pagination

`TablePagination` controls page navigation and page size.
In fetch mode, pagination state is mirrored into query params (`page`, `pageSize`).

---

## 8) Date Range Contract and URL Strategy

Reference contract:

- `frontend/src/features/advancedTable/docs/date-filter-contract.md`

Implemented URL strategy:

- canonical query params:
  - `start-date`
  - `end-date`
- normalized value format: `YYYY-MM-DDTHH:mm:ss` (local datetime string)
- URL is source of truth for selected date range in business integration
- invalid/missing URL values are healed to default quick range
- toolbar is presentation + callback; container owns URL mutation

### 8.1 Scope and target column

- Date range filtering targets `createdAt`.
- Quick ranges and custom ranges both resolve to the same `createdAt` contract.
- Current phase scope is single-column date range only (no multi-column fanout).

### 8.2 Boundary rules

- Start boundary is inclusive.
- End boundary is inclusive.
- Effective semantics: `createdAt >= start-date` and `createdAt <= end-date`.

### 8.3 Timezone rules

- UI displays date/time in local browser timezone.
- URL keeps local wall-time selection format (`YYYY-MM-DDTHH:mm:ss`).
- Fetch payload mapping uses URL-derived values without mutating selected wall time.

### 8.4 Invalid or partial URL handling

- If either param is missing/invalid, container should write both params with a valid default range.
- URL healing should preserve unrelated query params.
- Container should avoid write loops by writing only when normalized next values differ.

### 8.5 Fetch payload shape (date portion)

- Date range is sent both as synthetic filters and top-level date fields in fetch mode:
  - filter entries: `start-date`, `end-date`
  - normalized fields: `startDate`, `endDate`
- Existing column filters stay merged; date entries are additive and then consumed by backend/query function.

### 8.6 Synchronization rules

- Read URL params -> derive UI/table state.
- User date action in toolbar -> write URL params.
- URL param change -> table recomputes effective rows (local) or effective fetch params (remote).

### 8.7 Quick ranges in current implementation

Quick ranges currently supported in `dateFilter.ts`:

- `lastHour`
- `today`
- `thisWeek` (supports `weekStartsOn`)
- `thisMonth`

Note: the historical contract file contains earlier options/defaults (`last15min`, `lastDay`, `lastWeek`, `lastMonth`). The current implementation is the list above and should be treated as canonical unless contract versioning reintroduces legacy values.

---

## 9) Export Flow

Export is enabled through:

- `exportConfig.enabled`
- `exportConfig.storeColumns`
- `exportConfig.options`

Resolution order:

1. external `onExport` prop if provided,
2. internal table export handler when export config is enabled.

Current export behavior:

- exports filtered rows (`table.getFilteredRowModel()`),
- respects visible columns (`table.getVisibleLeafColumns()`),
- writes xlsx via `exportService.ts` (ExcelJS + blob download).

---

## 10) Persistence Flow

Persistence wiring:

- adapter from `createPersistenceAdapter("localStorage")`,
- key namespace from `buildTablePersistenceKeyPrefix(...)`,
- managed by `useColumnPersistence`.

Persisted aspects:

- column order,
- column visibility.

Reconciliation utilities ensure stored state remains valid when columns change across releases.

---

## 11) Details Modal Flow

Details modal is optional and driven by `detailsModal` config.

`StandaloneAdvancedTable` provides:

- open/close state,
- selected record tracking,
- previous/next navigation,
- keyboard navigation (`ArrowUp`/`ArrowDown`) when enabled.

`RecordDetailsModal` provides:

- draggable and resizable shell,
- close/prev/next controls,
- slot for custom header actions,
- custom detail content through `renderDetails(record, context)`.

---

## 12) Feature Flag / Safe Activation Pattern

Business integration currently supports safe activation:

- `enableDateToolbarFilter?: boolean` in `BusinessAdvancedTableSection`.

When enabled:

- date toolbar is rendered,
- URL date params are enforced/healed,
- table receives `dateRangeFilter`.

When disabled:

- legacy path remains active (no date-toolbar URL contract wiring).

This is the intended rollout mechanism before removing fallback code after QA sign-off.

---

## 13) Shared UI Component Policy (Shadcn Centralization)

Advanced table controls should use centralized UI primitives from:

- `frontend/src/components/ui`

Current runtime controls in advanced table are wired to shared UI components for:

- buttons,
- inputs,
- labels,
- select,
- popover,
- checkbox,
- calendar.

Rule for future work:

- do not add raw/native control elements where a shared shadcn wrapper exists in `@/components/ui`.

---

## 14) Add a New Screen Using Advanced Table (Recommended Recipe)

1. Create a page/container component for domain wiring.
2. Define row model and `TableColumnConfig[]`.
3. Decide data mode (`data` local, or `fetchConfig` remote).
4. Define `filterConfigs` and realtime policy.
5. Add `getRowId` for stable identity.
6. Add optional modules only as needed:
   - export
   - persistence
   - details modal
   - toolbar/date range
7. If date-range is URL-driven:
   - read/write `start-date` / `end-date` in container,
   - pass `dateRangeFilter` into table,
   - keep URL as source of truth.
8. Add/extend tests (unit + component + integration).

---

## 15) Testing Checklist (User + Developer Confidence)

Minimum checklist before merge:

- utilities:
  - quick-range generation,
  - parse/format/invalid datetime handling.
- toolbar:
  - quick range, custom range, refresh, popover behavior, keyboard flow.
- integration:
  - URL updates (`start-date`, `end-date`),
  - local-mode date filtering,
  - fetch-mode param mapping and result behavior,
  - combined date + column filters,
  - clear/reset behavior.
- table runtime:
  - sorting/filtering/pagination interactions.
- optional modules:
  - export success/failure path,
  - persistence load/save behavior,
  - details modal open/navigation.
- rollout safety:
  - feature flag enabled/disabled paths.

---

## 16) Maintenance Notes and Caveats

- If both `data` and `fetchConfig` are passed, local mode wins.
- Keep URL date contract and `dateFilter` quick-range semantics aligned with business rules.
- Keep shared UI usage centralized (`@/components/ui`) to avoid style/behavior drift.
- When removing fallback/feature-flag paths, update docs and tests in the same change.
- Keep integration containers (route/session/url) outside reusable table components.

---

## 17) Reference Files

- `frontend/src/features/advancedTable/components/StandaloneAdvancedTable.tsx`
- `frontend/src/features/advancedTable/components/GenericSearchBar.tsx`
- `frontend/src/features/advancedTable/components/RecordDetailsModal.tsx`
- `frontend/src/features/advancedTable/hooks/useEnhancedTable.ts`
- `frontend/src/features/advancedTable/hooks/useDynamicTableData.ts`
- `frontend/src/features/advancedTable/hooks/useTableFilters.ts`
- `frontend/src/features/advancedTable/hooks/useTableExport.ts`
- `frontend/src/features/advancedTable/hooks/useColumnPersistence.ts`
- `frontend/src/features/advancedTable/services/fetchService.ts`
- `frontend/src/features/advancedTable/services/exportService.ts`
- `frontend/src/features/advancedTable/services/persistenceService.ts`
- `frontend/src/features/advancedTable/utils/dateFilter.ts`
- `frontend/src/features/advancedTable/docs/date-filter-contract.md`
- `frontend/src/components/business/BusinessAdvancedTableSection.tsx`
