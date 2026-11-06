# ADR-0017: Theme mode as a server-persisted User preference

- **Status:** Accepted
- **Date:** 2026-11-06

## Context

ADR-0010 established the token-based, two-axis theming architecture and deliberately deferred **server-side theme preference sync**. It also placed the **Light / Dark / System** control in the account menu. That split the two personal display settings: language followed the User through their account, while theme mode lived only in the browser cache, so each device could show a different appearance. Settings also lived in a navigation surface instead of a dedicated page.

A grill settled a single account-scoped Preferences page for both language and appearance. Language and theme mode become per-user, server-persisted preferences that follow the person across sessions and devices. The account menu returns to navigation only.

## Decision

### 1. The User owns a theme preference

- The User holds an optional `themePreference` with values `light`, `dark`, or `system`.
- Unset means the effective appearance is `system` until the person chooses a value. Existing accounts are not migrated; they stay unset and therefore keep following the device's system appearance.
- `languagePreference` remains on the User exactly as it is. Theme is its peer, not a per-Business or per-Owner setting.

### 2. The profile API and session payloads carry it

- The existing self-service profile update accepts an optional `themePreference`; a blank value clears it back to unset. The profile read returns it.
- Login, refresh, sign-up, Google sign-up and sign-in, and the current-user read include `themePreference` beside `languagePreference`.
- No dedicated preferences endpoint is introduced.

### 3. Preferences is the only editor; the account menu is navigation

- `/account/preferences` is user-scoped, not Customer-mode-scoped. It exposes a **Language** section and an **Appearance** section, and every change applies immediately and persists on the User. A failed write surfaces a localized error.
- The account popover shows the current language as a read-only flag plus language name and adds a **Preferences** item. It exposes no language dropdown and no Light/Dark/System radio group. Account and Log out keep their existing behavior.
- The signed-out public navbar keeps the interactive `LanguageSwitcher`.
- Preferences is reachable from the customer account sidebar and from Business **Me** without changing the stored Customer | Business mode.

### 4. Device caches only make the first paint fast

- `pos.theme` (brand theme id) stays device-local and is not a User preference.
- `pos.mode` stays a device paint cache. The inline boot script applies it before React renders so the public site and the first authenticated paint do not flash to the default.
- Once a session is established, the User's `themePreference` is the source of truth and overrides the cached mode. Unset applies `system`. A successful sign-out leaves the current theme applied rather than reverting it.
- Language hydration keeps the same shape: the User preference wins after the session resolves, while the public site keeps the device language until sign-in.

## Consequences

**Positive**

- A person's language and appearance follow them across sessions and devices.
- One account-scoped page owns personal display settings, and the account menu stays a navigation surface.
- Existing accounts need no migration and keep a valid effective appearance.

**Negative / costs**

- The device cache and the server preference can disagree briefly after sign-in until hydration applies the server value. The boot cache still wins only for the first paint.
- Two settings now share one page and one profile-update path, so a partial save must be surfaced clearly per section.
- The account menu can no longer change appearance directly; the person needs one extra navigation step.

## Supersedes

- The ADR-0010 statement that "the account menu exposes Light / Dark / System".
- The ADR-0010 deferral of "server-side theme preference sync".

It does not change ADR-0010's token, registry, contrast, marketing, or shadcn architecture. Per-Business and per-Owner theming, a brand-theme picker, and user-selectable brand themes remain deferred.
