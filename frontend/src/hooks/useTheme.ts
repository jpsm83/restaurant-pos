import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME_ID,
  isThemeId,
  type ThemeId,
} from "@/styles/themes";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "pos.theme";
export const MODE_STORAGE_KEY = "pos.mode";

type ThemeState = {
  theme: ThemeId;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
};

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_ID;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

function readStoredMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function getSystemMode(): ResolvedThemeMode {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }
  try {
    return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function resolveMode(mode: ThemeMode): ResolvedThemeMode {
  return mode === "system" ? getSystemMode() : mode;
}

function createInitialState(): ThemeState {
  const mode = readStoredMode();
  return {
    theme: readStoredTheme(),
    mode,
    resolvedMode: resolveMode(mode),
  };
}

function persist(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be blocked */
  }
}

function applyThemeToDocument(state: ThemeState): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.classList.toggle(
    "dark",
    state.resolvedMode === "dark",
  );
}

let state = createInitialState();
const listeners = new Set<() => void>();
let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

function handleSystemModeChange(event: MediaQueryListEvent): void {
  if (state.mode !== "system") return;
  const resolvedMode: ResolvedThemeMode = event.matches ? "dark" : "light";
  if (resolvedMode === state.resolvedMode) return;
  state = { ...state, resolvedMode };
  applyThemeToDocument(state);
  notify();
}

function startSystemListener(): void {
  if (mediaQuery || state.mode !== "system") return;
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return;
  }
  mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
  mediaListener = handleSystemModeChange;
  mediaQuery.addEventListener("change", mediaListener);
}

function stopSystemListener(): void {
  if (!mediaQuery || !mediaListener) return;
  mediaQuery.removeEventListener("change", mediaListener);
  mediaQuery = null;
  mediaListener = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    applyThemeToDocument(state);
    startSystemListener();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopSystemListener();
  };
}

function getSnapshot(): ThemeState {
  return state;
}

export function setTheme(theme: ThemeId): void {
  const nextTheme = isThemeId(theme) ? theme : DEFAULT_THEME_ID;
  state = { ...state, theme: nextTheme };
  persist(THEME_STORAGE_KEY, nextTheme);
  applyThemeToDocument(state);
  notify();
}

export function setMode(mode: ThemeMode): void {
  const nextMode = isThemeMode(mode) ? mode : "system";
  state = {
    theme: state.theme,
    mode: nextMode,
    resolvedMode: resolveMode(nextMode),
  };
  persist(MODE_STORAGE_KEY, nextMode);
  applyThemeToDocument(state);
  if (nextMode === "system") {
    startSystemListener();
  } else {
    stopSystemListener();
  }
  notify();
}

export function resetThemeStore(): void {
  stopSystemListener();
  state = createInitialState();
  applyThemeToDocument(state);
  notify();
}

export type UseThemeResult = {
  theme: ThemeId;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
};

export function useTheme(): UseThemeResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    theme: snapshot.theme,
    mode: snapshot.mode,
    resolvedMode: snapshot.resolvedMode,
    setTheme,
    setMode,
  };
}
