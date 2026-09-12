import { STORY_PROGRESS_STEPS } from "./useScrollStory";

export function ScrollStoryProgress({ activeStep }: { activeStep: number }) {
  return (
    <nav className="scroll-story-progress" aria-label="ArtDera story progress">
      <div className="scroll-story-progress__line" aria-hidden="true">
        <span />
      </div>
      <ol>
        {STORY_PROGRESS_STEPS.map((label, index) => (
          <li key={label} data-active={index === activeStep || undefined}>
            <span className="scroll-story-progress__dot" aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
