/** Bounded LRU with single-flight fills. Rejections and oversized values are never cached. */
export class AsyncCache<T> {
  private readonly entries = new Map<string, { value: T; expires: number; bytes: number }>();
  private readonly pending = new Map<string, Promise<T>>();
  private bytes = 0;

  constructor(
    private readonly maxEntries = 200,
    private readonly maxBytes = 16 * 1024 * 1024,
    private readonly sizeOf: (value: T) => number = (value) =>
      Buffer.byteLength(JSON.stringify(value) ?? ""),
  ) {}

  async get(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expires > Date.now()) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry.value;
    }
    if (entry) this.remove(key);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const promise = Promise.resolve()
      .then(load)
      .then((value) => {
        // A clear during a fill must not repopulate an invalidated cache.
        if (this.pending.get(key) !== promise) return value;
        const bytes = this.sizeOf(value);
        if (bytes <= this.maxBytes) {
          this.entries.set(key, { value, expires: Date.now() + ttl, bytes });
          this.bytes += bytes;
          while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes)
            this.remove(this.entries.keys().next().value!);
        }
        return value;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
    this.pending.clear();
    this.bytes = 0;
  }
}
