/**
 * Translation key conventions (i18n plan — Task 0.5).
 *
 * **Namespaces**
 * - One JSON file per namespace per locale: `locales/<lang>/<namespace>.json`.
 * - Valid namespace names are `NAMESPACES` in `./index.ts` (`common`, `nav`, `auth`, …).
 * - In components: `useTranslation("nav")` (or `t("key", { ns: "nav" })`). Do not prefix keys with `nav:` inside `t()` when the hook is already scoped to `nav`.
 *
 * **Keys**
 * - Prefer **nested objects** in JSON and **dot paths** in `t()`, e.g. `t("account.signOut")` for `{ "account": { "signOut": "…" } }`.
 * - Use **stable, semantic** segments (`errors.network.timeout`), not display-order labels (`errors.e1`).
 *
 * **Typing (v1)**
 * - Keys remain `string` at compile time. Optional later: `i18next-parser`, `typesafe-i18n`, or custom codegen. Until then, rely on review and tests.
 */

export {};
