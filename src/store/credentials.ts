import { DEFAULT_API_URL } from '../api/greenApi';

const STORAGE_KEY = 'green-api-max-chat:credentials';

export interface StoredCredentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.apiUrl === 'string' &&
    typeof record.idInstance === 'string' &&
    typeof record.apiTokenInstance === 'string'
  );
}

/** Reads saved credentials; returns `null` when nothing usable is stored. */
export function loadCredentials(): StoredCredentials | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredCredentials(parsed)) return null;
    return {
      apiUrl: parsed.apiUrl.trim() || DEFAULT_API_URL,
      idInstance: parsed.idInstance.trim(),
      apiTokenInstance: parsed.apiTokenInstance.trim(),
    };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: StoredCredentials): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Storage can be unavailable (private mode); the app still works in memory.
  }
}

export function clearCredentials(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
