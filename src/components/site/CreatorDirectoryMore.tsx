import { useEffect, useRef, useState } from "react";
import type { Creator } from "@/lib/artdera";
import { fetchCreatorPage } from "@/lib/server-loaders";

export function CreatorDirectoryMore({
  type,
  initialCursor,
  onPage,
  resetKey,
}: {
  type: "artist" | "gallery";
  initialCursor: string | null;
  onPage: (items: Creator[]) => void;
  resetKey: object;
}) {
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const callback = useRef(onPage);
  callback.current = onPage;
  useEffect(() => {
    ++generation.current;
    busy.current = false;
    setCursor(initialCursor);
    setError(false);
    setLoading(false);
    return () => {
      // This ref counts requests; it does not reference a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
    };
  }, [initialCursor, resetKey]);
  const load = async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    const requestGeneration = generation.current;
    try {
      const page = await fetchCreatorPage({ data: { type, cursor } });
      if (requestGeneration !== generation.current) return;
      callback.current(page.items);
      setCursor(page.nextCursor);
    } catch {
      if (requestGeneration === generation.current) setError(true);
    } finally {
      if (requestGeneration === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!cursor || !sentinel.current || error) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadRef.current();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, error]);
  if (!cursor) return null;
  return (
    <div ref={sentinel} className="mt-10 text-center">
      <button type="button" className="btn-ghost" disabled={loading} onClick={() => void load()}>
        {loading ? "Loading…" : error ? "Try again" : "Load more"}
      </button>
    </div>
  );
}
