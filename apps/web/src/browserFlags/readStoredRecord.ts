/** Parse a localStorage key as JSON; caller supplies the expected on-disk shape. */
export function readStoredRecord<T extends object>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object") {
      return data as T;
    }
    return null;
  } catch {
    return null;
  }
}
