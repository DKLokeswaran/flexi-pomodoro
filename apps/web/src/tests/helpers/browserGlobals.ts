/** Install an in-memory localStorage stand-in; returns the backing map. */
export function installMemoryLocalStorage(): Map<string, string> {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  return map;
}

/** Install an Audio stand-in that records every source asked to play. */
export function installRecordingAudio(): string[] {
  const played: string[] = [];
  class RecordingAudio {
    constructor(private readonly src: string) {}
    play(): Promise<void> {
      played.push(this.src);
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, "Audio", {
    value: RecordingAudio,
    configurable: true,
  });
  return played;
}
