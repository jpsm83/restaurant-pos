export type StyleViolationCategory = "colors" | "arbitraryValues";

export type StyleViolationKind =
  | "raw-palette"
  | "raw-colour"
  | "arbitrary-value";

export interface StyleFile {
  path: string;
  content: string;
}

export interface StyleAllowlist {
  colors?: string[];
  arbitraryValues?: string[];
}

export interface StyleViolation {
  path: string;
  line: number;
  column: number;
  category: StyleViolationCategory;
  kind: StyleViolationKind;
  token: string;
  message: string;
}

export function findStyleViolations(
  files: readonly StyleFile[],
  allowlist?: StyleAllowlist,
): StyleViolation[];
