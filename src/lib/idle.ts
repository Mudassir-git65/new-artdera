/** Run noncritical work after page resources finish and the main thread is idle. */
export function afterPageLoad(task: () => void, timeout = 3000) {
  let cancelled = false;
  let idle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (cancelled) return;
    if ("requestIdleCallback" in window)
      idle = window.requestIdleCallback(
        () => {
          if (!cancelled) task();
        },
        { timeout },
      );
    else
      timer = setTimeout(() => {
        if (!cancelled) task();
      }, 1);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
