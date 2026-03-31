# Advanced Table Public API and Screen Integration

This document is the source of truth for using the migrated advanced table in `frontend`.

## Final Import Path

Use the feature barrel:

- `@/features/advancedTable`

Primary component import:

- `StandaloneAdvancedTable`

Common companion imports:

- `TableConfigEditor`
- `shouldDisableSave`
- `buildTablePersistenceKeyPrefix`
- `createPersistenceAdapter`
- `queryKeys.advancedTable.*` (from `@/services/queryKeys`)

## Core Prop Contracts

`StandaloneAdvancedTable` supports two data modes.

### 1) Controlled data mode (`data`)

Use when the parent already owns the row array.

Required:

- `columns`
- `data`

Optional but common:

- `getRowId`
- `pageSize`
- `emptyStateMessage`
- `emptyStateSubMessage`

### 2) Endpoint-driven mode (`fetchConfig`)

Use when the table should drive sorting/filter/pagination and refetch from server.

Required:

- `columns`
- `fetchConfig.queryKey(params)`
- `fetchConfig.queryFn(params)`

Expected `params` shape from table state:

- `sorting`
- `filters`
- `page`
- `pageSize`

`fetchConfig.queryFn` should return the row array for the current page.

## Optional Feature Configs

### Details modal

- `detailsModal.enabled`
- `detailsModal.renderDetails(record, context)`
- `detailsModal.allowKeyboardNavigation` (optional)

### Export

- `exportConfig.enabled`
- `exportConfig.storeColumns`
- `exportConfig.options.fileName`
- `exportConfig.options.sheetName`
- Optional `exportConfig.onError`

### Persistence

- `persistence.enabled`
- `persistence.adapter` (use `createPersistenceAdapter("localStorage")`)
- `persistence.keyPrefix` (use `buildTablePersistenceKeyPrefix(...)`)

### Column/filter behavior

- `defaultColumnOrder`
- `defaultColumnVisibility`
- `initialColumnOrder`
- `initialColumnVisibility`
- `filterConfigs` (for dropdown/input filter behavior)

## How To Add a New Table Screen

Use this checklist for any new route/page.

1. Create a page-level container in `frontend/src/pages/...` (example style: `BusinessAdvancedTableSection.tsx`).
2. Define typed row model for that screen.
3. Build `columns` with stable `id` and `accessorKey`.
4. Choose data mode:
   - controlled (`data`), or
   - endpoint-driven (`fetchConfig` + `queryKeys` namespace).
5. Provide stable row identity with `getRowId`.
6. Configure optional features needed by the screen:
   - details modal
   - export
   - persistence
   - table config editor
7. Namespace persistence keys with `buildTablePersistenceKeyPrefix`.
8. Add/extend tests:
   - helper/unit tests for new adapters/mappers
   - page-level integration test in `frontend/src/pages/...`
9. Validate manually:
   - sort/filter/page flow
   - modal behavior
   - export behavior
   - persistence after refresh
10. Run:
   - `npm run test`
   - `npm run build`

## Current Reference Implementation

Use the business dashboard integration as baseline:

- `frontend/src/pages/business/BusinessDashboardPage.tsx`
- `frontend/src/pages/business/BusinessAdvancedTableSection.tsx`
