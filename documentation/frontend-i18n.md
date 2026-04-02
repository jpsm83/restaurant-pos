# Frontend internationalization (i18n)

Developer guide for **i18next** + **react-i18next** in `frontend/`.

**Related docs**

| Document | Role |
|----------|------|
| [`i18n-implementation-plan.md`](./i18n-implementation-plan.md) | **Status and backlog**: what is done (`en`/`es`, namespaces, parity script), what is optional next (Intl, i18next-parser). |
| [`i18n-locale-coverage-todo.md`](./i18n-locale-coverage-todo.md) | **Inventory**: which TSX files use which namespace; blocks 0–9 completed Mar 2026. |
| [`frontend-third-party-libraries.md`](./frontend-third-party-libraries.md) | **Forms + npm stack**: React Hook Form + Zod schemas usually take **`t("…")` message strings** in the **same file as the form**; add matching keys under `auth` (and other namespaces) in **`en`/`es`**. |

---

## Layout

| Path | Role |
|------|------|
| [`frontend/src/i18n/i18n.ts`](../frontend/src/i18n/i18n.ts) | **Only TS entry:** i18next bootstrap (glob of locale JSON, `init`, `changeAppLanguage`, storage key, `react.useSuspense: false`). `main.tsx` side-imports `./i18n/i18n` before render; app code imports `@/i18n/i18n` when it needs the singleton or helpers. |
| `frontend/src/i18n/locales/<lang>/<namespace>.json` | One file per **namespace** per **language** (`en`, `es` only). |
| [`frontend/src/test/i18nTestUtils.tsx`](../frontend/src/test/i18nTestUtils.tsx) | Tests: `createTestI18n()`, `renderWithI18n()` (isolated instance + `I18nextProvider`). |
| [`frontend/scripts/check-i18n-locale-parity.mjs`](../frontend/scripts/check-i18n-locale-parity.mjs) | **`npm run i18n:check-parity`** — fails CI if `en` and `es` differ in leaf key paths for any namespace. |

**Namespaces** (must match `NAMESPACES` in `i18n.ts`): `common`, `nav`, `auth`, `marketing`, `business`, `customer`, `employee`, `mode`, `errors`.

Adding a **new namespace** requires: a new entry in `NAMESPACES`, `<namespace>.json` under **`en`** and **`es`** with the **same key tree**, and updating [`i18n-locale-coverage-todo.md`](./i18n-locale-coverage-todo.md). New glob entries are picked up automatically.

---

## Locale coverage (March 2026)

- **Spanish (`es`)** is **fully keyed and translated** for all nine namespaces, matching the [presentation inventory](./i18n-locale-coverage-todo.md).
- Run **`npm run i18n:check-parity`** from **`frontend/`** before merge when touching locale JSON.

---

## Conventions

- **JSON shape:** Prefer nested objects; address keys with **dot paths** in `t()`, e.g. `t("auth.signIn")` for `{ "auth": { "signIn": "…" } }`.
- **Hooks:** `const { t, i18n } = useTranslation("nav")` — stay inside the namespace you pass; do not duplicate `nav:` in every key when the hook is already scoped.
- **Other namespace in one call:** `t("key", { ns: "errors" })` or a second `useTranslation("errors")`.
- **Rich copy:** Use `<Trans>` from `react-i18next` when you need inline elements; see i18next docs. **Policy:** `interpolation.escapeValue` is `false` because React escapes text nodes; do not pass untrusted strings into `<Trans>` `components` unless content is safe.
- **Class components / non-React:** `import i18n from "@/i18n/i18n"` and `i18n.t("boundary.title", { ns: "errors" })`.

**Locale chrome vs fallback:** With `fallbackLng: "en"`, **`i18n.resolvedLanguage`** may stay `en` while **`i18n.language`** reflects the user’s choice. Use **`i18n.language`** for UI that must match the selected locale (e.g. the language switcher’s **flag**). Use `t()` for strings (they resolve with fallback per key).

**React Suspense:** `init({ react: { useSuspense: false } })` avoids requiring a root Suspense boundary when changing language or loading namespaces.

---

## How to add or change a string

1. **Pick a namespace** (e.g. navbar copy → `nav`, shared buttons → `common`).
2. **Edit** `frontend/src/i18n/locales/en/<namespace>.json` — add or adjust nested keys and English value.
3. **Spanish:** Add the **same key paths** under `es/<namespace>.json` with translated values. Missing keys fall back to **`en`** via `fallbackLng`.
4. **Component:** `useTranslation("<namespace>")` and `t("your.key")`, or `<Trans i18nKey="…" ns="…" />` as needed.
5. **Verify:** `npm run i18n:check-parity` from `frontend/`.
6. **Tests** that assert visible text: prefer **`renderWithI18n`** from `@/test/i18nTestUtils` instead of importing `@/i18n/i18n` (avoids mutating the app singleton). Spying **`changeAppLanguage`** may still require importing `@/i18n/i18n` (see `Navbar.test.tsx`).

---

## Language persistence and switching

- **Storage key:** `I18N_STORAGE_KEY` = `restaurant_pos_i18n_lng` (see `i18n.ts`).
- **On load:** `lng` is chosen synchronously in `init`: valid value in `localStorage` first, else the first supported match from `navigator.language` / `navigator.languages` (e.g. `es-MX` → `es`), else **`en`**. That keeps first paint aligned with saved choice or browser preference.
- **UI:** The navbar **LanguageSwitcher** calls **`changeAppLanguage(code)`** (validates against `SUPPORTED_LANGUAGES`, then `i18n.changeLanguage`). **Native language names** and switcher aria label live in **`common`** (`languages.*`, `languageSwitcher.ariaLabel`).
- **Flags:** [`LanguageSwitcher`](../frontend/src/components/LanguageSwitcher.tsx) imports **`US`** / **`ES`** from **`country-flag-icons/react/3x2`** and renders them via a small **`LanguageFlagIcon`** helper (`es` → ES, otherwise US). [`useLanguageOptions`](../frontend/src/hooks/useLanguageOptions.ts) only supplies codes and translated labels.

---

## Supported languages

Codes: **`en`**, **`es`** only. Flags: **US** (English), **ES** (Spanish). To add more languages later: new folder under `locales/`, extend `SUPPORTED_LANGUAGES` in `i18n/i18n.ts` and `useLanguageOptions.ts`, add `languages.<code>` in **`en`** and **`es`** `common.json`, and extend the parity script’s expectations (still one `es` mirror per namespace, or generalize the script).

---

## Dates and numbers

User-visible **locale-aware** dates/times/currency are **not** centralized yet. Internal helpers (e.g. schedule **day keys**) use fixed formats, not `Intl`. When adding formatted dates or numbers to the UI, use **`Intl.*`** with an explicit locale derived from **`i18n.language`**, or add a small formatting helper — see [`i18n-implementation-plan.md`](./i18n-implementation-plan.md) backlog.
