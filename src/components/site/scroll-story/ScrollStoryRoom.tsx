import { useState } from "react";

export function ScrollStoryRoom({ image }: { image: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="scroll-story-room" aria-hidden="true">
      {!failed && (
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="scroll-story-room__image"
        />
      )}
      <div className="scroll-story-room__wall" />
      <div className="scroll-story-room__arch" />
      <div className="scroll-story-room__floor" />
      <div className="scroll-story-room__console" />
      <div className="scroll-story-room__vase" />
      <div className="scroll-story-room__light" />
    </div>
  );
}
