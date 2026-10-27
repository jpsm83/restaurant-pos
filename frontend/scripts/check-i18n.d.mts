export type I18nViolationCategory =
  | "locale"
  | "used-key"
  | "default-value"
  | "hardcoded-copy";

export type I18nViolationKind =
  | "missing-key"
  | "extra-key"
  | "plural-drift"
  | "placeholder-drift"
  | "missing-namespace"
  | "missing-used-key"
  | "english-default-value"
  | "jsx-text"
  | "string-attribute"
  | "toast-literal"
  | "literal-property"
  | "prop-default"
  | "template-aria-label";

export interface I18nFile {
  path: string;
  content: string;
}

export interface I18nViolation {
  path: string;
  line: number;
  column: number;
  category: I18nViolationCategory;
  kind: I18nViolationKind;
  token: string;
  message: string;
}

export function findLocaleViolations(
  localeFiles: readonly I18nFile[],
): I18nViolation[];

export function findSourceViolations(
  sourceFiles: readonly I18nFile[],
  localeFiles: readonly I18nFile[],
): I18nViolation[];

export function findI18nViolations(
  sourceFiles: readonly I18nFile[],
  localeFiles: readonly I18nFile[],
): I18nViolation[];
