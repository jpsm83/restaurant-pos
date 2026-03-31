export type PersistenceStorage = "localStorage" | "sessionStorage";

export interface PersistenceAdapter {
  save<TValue>(key: string, value: TValue): void;
  load<TValue>(key: string, fallback: TValue): TValue;
  remove(key: string): void;
}

export interface TablePersistenceScope {
  appId?: string;
  screenId: string;
  tableId: string;
}

export function buildTablePersistenceKeyPrefix({
  appId = "restaurant-pos",
  screenId,
  tableId,
}: TablePersistenceScope): string {
  return `${appId}:advanced-table:${screenId}:${tableId}`;
}

function getStorage(storage: PersistenceStorage): Storage {
  const target =
    storage === "sessionStorage" ? globalThis.sessionStorage : globalThis.localStorage;
  if (!target) {
    throw new Error(`${storage} is unavailable in current environment.`);
  }
  return target;
}

/**
 * Creates a minimal persistence adapter for standalone table preferences.
 */
export function createPersistenceAdapter(storage: PersistenceStorage = "localStorage"): PersistenceAdapter {
  return {
    save<TValue>(key: string, value: TValue): void {
      const targetStorage = getStorage(storage);
      targetStorage.setItem(key, JSON.stringify(value));
    },
    load<TValue>(key: string, fallback: TValue): TValue {
      const targetStorage = getStorage(storage);
      const raw = targetStorage.getItem(key);
      if (!raw) return fallback;

      try {
        return JSON.parse(raw) as TValue;
      } catch {
        return fallback;
      }
    },
    remove(key: string): void {
      const targetStorage = getStorage(storage);
      targetStorage.removeItem(key);
    },
  };
}
