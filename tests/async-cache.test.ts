import { describe, expect, it, vi } from "vitest";
import { AsyncCache } from "../server/lib/async-cache";

describe("bounded asynchronous cache", () => {
  it("collapses simultaneous fills and retries failed loads", async () => {
    const cache = new AsyncCache<number>();
    const load = vi.fn(async () => 42);
    expect(
      await Promise.all(Array.from({ length: 50 }, () => cache.get("one", 1000, load))),
    ).toEqual(Array(50).fill(42));
    expect(load).toHaveBeenCalledTimes(1);
    await expect(
      cache.get("bad", 1000, async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(await cache.get("bad", 1000, async () => 7)).toBe(7);
  });

  it("evicts by memory and does not resurrect invalidated in-flight work", async () => {
    const cache = new AsyncCache<string>(2, 4, (value) => value.length);
    await cache.get("one", 1000, async () => "12");
    await cache.get("two", 1000, async () => "34");
    await cache.get("three", 1000, async () => "567");
    const reload = vi.fn(async () => "ab");
    await cache.get("one", 1000, reload);
    expect(reload).toHaveBeenCalledOnce();
    let finish!: (value: string) => void;
    const pending = cache.get(
      "pending",
      1000,
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    cache.clear();
    finish("old");
    await pending;
    expect(await cache.get("pending", 1000, async () => "new")).toBe("new");
  });
});
