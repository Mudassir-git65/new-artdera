export function ScrollStoryArtwork() {
  return (
    <div className="scroll-story-artwork" aria-hidden="true">
      <svg viewBox="0 0 640 760" role="presentation" focusable="false">
        <defs>
          <filter id="scroll-story-paper-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="11" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.085" />
            </feComponentTransfer>
          </filter>
          <linearGradient id="scroll-story-terracotta" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#B65F42" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#6E2334" stopOpacity="0.72" />
          </linearGradient>
          <mask id="scroll-story-form-mask">
            <rect
              className="scroll-story-form-mask"
              x="0"
              y="0"
              width="640"
              height="760"
              fill="white"
            />
          </mask>
        </defs>

        <rect width="640" height="760" fill="#FFFDFC" />
        <rect width="640" height="760" filter="url(#scroll-story-paper-grain)" />

        <g className="scroll-story-construction">
          <path d="M88 187 C188 130 304 122 426 164 C496 188 536 220 570 268" />
          <path d="M120 594 C190 515 274 474 384 474 C470 476 536 510 594 566" />
          <path d="M318 88 L318 680" />
        </g>

        <path
          className="scroll-story-stroke scroll-story-stroke--main"
          d="M92 472 C160 362 234 318 314 354 C378 382 424 370 476 298 C510 252 544 230 582 222"
          pathLength={1}
        />

        <path
          className="scroll-story-calligraphy"
          d="M162 230 C206 278 232 300 278 286 C324 272 316 212 274 214 C224 216 218 302 280 334 C340 366 430 318 460 254"
          pathLength={1}
        />

        <g className="scroll-story-painted-form" mask="url(#scroll-story-form-mask)">
          <path
            d="M116 512 C176 430 240 396 312 412 C382 426 430 390 492 330 C548 276 604 304 592 380 C574 492 464 598 314 606 C222 610 138 574 116 512Z"
            fill="url(#scroll-story-terracotta)"
          />
          <path
            d="M178 414 C240 342 316 312 386 334 C446 354 468 408 432 470 C390 540 270 548 206 502 C174 478 156 448 178 414Z"
            fill="#F6F1E8"
            opacity="0.48"
          />
        </g>

        <g className="scroll-story-indigo-details">
          <path d="M126 178 C214 250 298 274 398 240 C474 214 522 226 572 282" pathLength={1} />
          <path d="M174 628 C230 574 294 548 370 556 C444 564 504 604 552 662" pathLength={1} />
          <circle cx="438" cy="214" r="10" />
          <circle cx="476" cy="250" r="5" />
          <circle cx="404" cy="260" r="4" />
        </g>

        <g className="scroll-story-digital-points">
          <circle cx="132" cy="330" r="2.4" />
          <circle cx="164" cy="352" r="1.9" />
          <circle cx="198" cy="318" r="2.2" />
          <circle cx="516" cy="448" r="2" />
          <circle cx="544" cy="420" r="1.8" />
          <path d="M132 330 L164 352 L198 318" />
          <path d="M516 448 L544 420" />
        </g>
      </svg>

      <div className="scroll-story-frame" aria-hidden="true">
        <span data-edge="top" />
        <span data-edge="right" />
        <span data-edge="bottom" />
        <span data-edge="left" />
      </div>

      <div className="scroll-story-metadata" aria-hidden="true">
        <span>Original</span>
        <span>Handmade</span>
        <span>AI Disclosed</span>
      </div>
    </div>
  );
}
