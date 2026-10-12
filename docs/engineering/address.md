# Address model and business address settings

## Shared physical address (`IAddress` / `addressSchema`)

Structured addresses are shared across **Business**, **Supplier**, **User `personalDetails`**, and delivery flows. The Mongoose shape lives in **`backend/src/models/address.ts`**; the TypeScript contract is **`packages/interfaces/IAddress.ts`**.

- **Required:** `country`, `state`, `city`, `street`, `buildingNumber`, `postCode`.
- **Optional:** `doorNumber` (unit / door / apartment id), `complement` (second line: floor, wing, etc.), `region`, `additionalDetails`, `coordinates` (`[longitude, latitude]`).

Multipart **business** and **user** profile routes validate address JSON with the shared zod address schema in **`packages/schemas/address.ts`**. The business settings **address** page and **business registration** form must stay aligned with this model (RHF + Zod on the frontend).

## Business address settings — location preview (map)

The tenant **postal address** editor lives at **`/business/:businessId/settings/address`** (**`BusinessAddressSettingsPage`** in `frontend/src/pages/business/BusinessAddressSettingsPage.tsx`). It uses the same split-settings shell as other business profile slices (**`BusinessProfileSettingsFormShell`** + **`useBusinessProfileSettingsController`**) so address fields are part of the full profile form and save with **`PATCH /api/v1/business/:businessId`**. Its **`loadingSlot`** mirrors the loaded layout: **`section`** + **`header`**, address field grid with the same column spans as street/complement full-width rows, and the map column (**`h3`**-style title + map placeholder).

- **Location preview:** **`BusinessAddressLocationMap`** (`frontend/src/components/BusinessAddressLocationMap.tsx`) shows an **OpenStreetMap** tile layer and geocodes a free-text query with **Nominatim** via **`leaflet-control-geocoder`** (public service; respect OSM usage policy in production).
- **Query string:** Built locally with **`buildAddressGeocodeQuery`** on the address page: **street-first** parts joined with commas (`street`, `buildingNumber`, `city`, `state`, `postCode`, `region`, `country`). **`doorNumber`** and **`complement`** are **omitted** from the geocode string only (they remain on the saved profile); unit-level text often prevents Nominatim from matching.
- **When the map refetches:** The first time a **non-empty** trimmed query reaches the map (length ≥ **3**), geocoding runs **immediately** so the pin appears on load. **Later** changes to the query (after that first scheduled run) are **debounced by 3 seconds** before another Nominatim request. While the query is too short, the map shows the default world view and a short hint.
- **Form vs saved data:** If the user has not dirtied the form, the preview can fall back to the **saved** address from the profile query when live `useWatch` values are still empty (e.g. before `reset` applies on the first tick).

The frontend stack behind the map is documented in [`frontend-third-party-libraries.md`](./frontend-third-party-libraries.md).

## Business timezone (derived from the address)

A business has **one authoritative IANA timezone** at the top level of the **`Business`** model and the shared **`IBusiness`** interface (`packages/interfaces/IBusiness.ts`). It is **not** user-selectable: the server derives it from the structured **address** (`country` + `state`).

- **Resolver:** **`packages/utils/timezoneFromAddress.ts`** maps a free-text `country`/`state` (ISO codes or English names; case/accent/punctuation insensitive) to a canonical zone. Lookup order is **country + state override → country primary zone → `undefined`**.
- **Data:** **`packages/utils/timezoneData.ts`** is **auto-generated** from the IANA tz database **`zone.tab`** (single-zone countries map directly; multi-zone countries use a curated primary), with curated state/province overrides for **US, CA, AU, BR, MX, ES, PT, NZ**. Names use the identifiers reported by `Intl.supportedValuesOf("timeZone")` so values round-trip through **`timezoneSchema`**.
- **When it is written:** registration (`POST /api/v1/business`) and any profile update that carries an address (`PATCH /api/v1/business/:businessId`) recompute the zone server-side. The client never sends a timezone.
- **Read fallback:** when a business has no zone (legacy) or an invalid one, the profile read (`GET /api/v1/business/:businessId`) returns **`timezone: "UTC"`** and **`timezoneIsDefault: true`**; otherwise it returns the stored zone with `timezoneIsDefault: false`.
- **UI:** the profile settings core section shows the derived zone **read-only** and surfaces a "couldn't determine your time zone" prompt when `timezoneIsDefault` is true, directing the user to update the address. Changing the address is the only way to change the zone.
