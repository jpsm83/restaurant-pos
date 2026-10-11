# Advanced Table Date-Filter Contract

Authoritative contract for the advanced-table date-range filter
(`frontend/src/features/advancedTable`). It supersedes the earlier
browser-local `YYYY-MM-DDTHH:mm:ss` contract: a plain calendar date is
unambiguous, while an offset-less date-time is not.

## 1) Value format

- Date-range values are plain calendar dates: `YYYY-MM-DD`.
- No time-of-day and no UTC offset are emitted.
- A date-time string (with or without an offset) is not a valid value.

## 2) Inputs

- The toolbar date filter accepts calendar dates only: a start date and an end
  date. There are no time-of-day inputs.
- Quick ranges are date-based:
  - `today`
  - `thisWeek` (honors `weekStartsOn`)
  - `thisMonth`
- Sub-day ranges (for example `lastHour`) are not part of the contract; a
  date-only value cannot express them.
- Legacy quick-range keys normalize to the date-only set: `last15min`,
  `lastHour`, `lastDay` -> `today`; `lastWeek` -> `thisWeek`; `lastMonth` ->
  `thisMonth`.

## 3) Query / URL shape

- Canonical query params: `start-date`, `end-date`.
- Both carry `YYYY-MM-DD`.
- Fetch mode sends the same values as synthetic filters (`start-date`,
  `end-date`) and as top-level `startDate` / `endDate` fields.

## 4) Semantics

- Start and end boundaries are inclusive calendar dates.
- The date is a **business-local** calendar date. The backend resolves each date
  to that business day's UTC bounds using the business's own timezone. The
  client never applies a browser-local offset to the emitted value.
- Local (in-memory) mode is a browser-local fallback: it resolves the range to
  the browser-local start-of-day and end-of-day instants.

## 5) Out of scope

- Business-local **display** of timestamps. Record timestamps keep their current
  browser-local display; only the filter value is date-only and business-local.
