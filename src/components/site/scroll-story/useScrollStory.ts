import { useCallback, useEffect, useState, type RefObject } from "react";

export const SCENE_RANGES = {
  blank: [0, 0.08],
  firstMark: [0.06, 0.24],
  creation: [0.24, 0.46],
  framing: [0.46, 0.62],
  room: [0.62, 0.82],
  product: [0.82, 1],
} as const;

export const STORY_PROGRESS_STEPS = [
  "01 Idea",
  "02 Expression",
  "03 Creation",
  "04 Framing",
  "05 Your Space",
  "06 Marketplace",
];

const ACTIVE_STEP_THRESHOLDS = [0, 0.06, 0.24, 0.46, 0.62, 0.82];

export function normalizeProgress(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sceneOpacity(progress: number, start: number, peak: number, end: number) {
  return Math.min(
    normalizeProgress(progress, start, peak),
    1 - normalizeProgress(progress, peak, end),
  );
}

function activeStepFromProgress(progress: number) {
  let active = 0;
  for (let index = 0; index < ACTIVE_STEP_THRESHOLDS.length; index += 1) {
    if (progress >= ACTIVE_STEP_THRESHOLDS[index]) active = index;
  }
  return active;
}

export function useScrollStory(sectionRef: RefObject<HTMLElement | null>) {
  const [activeStep, setActiveStep] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion) return;
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    let lastStep = -1;
    let disposed = false;

    const writeProgress = () => {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top + window.scrollY;
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = clamp((window.scrollY - sectionTop) / scrollable);

      const blank = normalizeProgress(progress, SCENE_RANGES.blank[0], SCENE_RANGES.blank[1]);
      const expression = normalizeProgress(
        progress,
        SCENE_RANGES.firstMark[0],
        SCENE_RANGES.firstMark[1],
      );
      const creation = normalizeProgress(
        progress,
        SCENE_RANGES.creation[0],
        SCENE_RANGES.creation[1],
      );
      const framing = normalizeProgress(progress, SCENE_RANGES.framing[0], SCENE_RANGES.framing[1]);
      const room = normalizeProgress(progress, SCENE_RANGES.room[0], SCENE_RANGES.room[1]);
      const product = normalizeProgress(progress, SCENE_RANGES.product[0], SCENE_RANGES.product[1]);

      section.style.setProperty("--story-progress", progress.toFixed(4));
      section.style.setProperty("--story-blank", blank.toFixed(4));
      section.style.setProperty("--story-expression", expression.toFixed(4));
      section.style.setProperty("--story-expression-inverse", (1 - expression).toFixed(4));
      section.style.setProperty("--story-creation", creation.toFixed(4));
      section.style.setProperty("--story-creation-inverse", (1 - creation).toFixed(4));
      section.style.setProperty("--story-framing", framing.toFixed(4));
      section.style.setProperty("--story-framing-inverse", (1 - framing).toFixed(4));
      section.style.setProperty("--story-room", room.toFixed(4));
      section.style.setProperty("--story-room-inverse", (1 - room).toFixed(4));
      section.style.setProperty("--story-product", product.toFixed(4));
      section.style.setProperty(
        "--story-copy-idea",
        sceneOpacity(progress, 0, 0.08, 0.18).toFixed(4),
      );
      section.style.setProperty(
        "--story-copy-expression",
        sceneOpacity(progress, 0.07, 0.16, 0.28).toFixed(4),
      );
      section.style.setProperty(
        "--story-copy-creation",
        sceneOpacity(progress, 0.25, 0.36, 0.5).toFixed(4),
      );
      section.style.setProperty(
        "--story-copy-framing",
        sceneOpacity(progress, 0.47, 0.55, 0.66).toFixed(4),
      );
      section.style.setProperty(
        "--story-copy-room",
        sceneOpacity(progress, 0.64, 0.75, 0.86).toFixed(4),
      );

      const nextStep = activeStepFromProgress(progress);
      if (nextStep !== lastStep) {
        lastStep = nextStep;
        setActiveStep(nextStep);
      }
    };

    const runScheduled = () => {
      frame = 0;
      writeProgress();
    };

    const schedule = () => {
      if (disposed || frame) return;
      frame = window.requestAnimationFrame(runScheduled);
    };

    schedule();
    const heartbeat = window.setInterval(() => {
      if (disposed) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom > -window.innerHeight && rect.top < window.innerHeight * 2) {
        writeProgress();
      }
    }, 120);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion, sectionRef]);

  const skipToEnd = useCallback(() => {
    if (typeof document === "undefined") return;
    const nextSection =
      document.getElementById("trust-strip") ?? sectionRef.current?.nextElementSibling;
    nextSection?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [prefersReducedMotion, sectionRef]);

  return { activeStep, prefersReducedMotion, skipToEnd };
}
