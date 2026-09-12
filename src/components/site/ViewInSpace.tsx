import { RotateCcw, Save, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import type { Product } from "@/lib/artdera";
import { IMAGES } from "@/lib/artdera";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FrameColor = "ink" | "oak" | "ivory";

const FRAME_COLORS: Record<FrameColor, string> = {
  ink: "#171717",
  oak: "#8E5B3E",
  ivory: "#F6F1E8",
};

export function ViewInSpace({ product }: { product: Product }) {
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(product.images[0]);
  const [frame, setFrame] = useState<FrameColor>("ink");
  const [x, setX] = useState(50);
  const [y, setY] = useState(38);
  const [size, setSize] = useState(34);
  const [saved, setSaved] = useState(false);

  const previewStyle = useMemo(
    () => ({
      left: `${x}%`,
      top: `${y}%`,
      width: `${size}%`,
      borderColor: FRAME_COLORS[frame],
    }),
    [frame, size, x, y],
  );

  function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRoomImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  function reset() {
    setRoomImage(null);
    setActiveImage(product.images[0]);
    setFrame("ink");
    setX(50);
    setY(38);
    setSize(34);
    setSaved(false);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="btn-ghost w-full py-3.5">
          View in Your Space
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-3rem)] max-w-6xl overflow-y-auto rounded-2xl bg-[var(--porcelain)] p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-[var(--color-border)] p-5 pr-12 text-left">
          <DialogTitle className="font-display text-3xl font-normal">
            View in Your Space
          </DialogTitle>
          <DialogDescription>
            Upload a room photo, position the work and approximate scale before you commit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-0 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="p-4 md:p-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--ivory)]">
              <img
                src={roomImage ?? IMAGES.heroInterior}
                alt={roomImage ? "Uploaded room preview" : "Sample room preview"}
                className="h-full w-full object-cover"
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 border-[8px] bg-[var(--porcelain)] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
                style={previewStyle}
              >
                <img
                  src={activeImage}
                  alt={product.title}
                  className="block aspect-[4/5] w-full object-cover"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              This is a visual approximation. Always check exact dimensions before ordering.
            </p>
          </div>

          <div className="border-t border-[var(--color-border)] p-5 lg:border-l lg:border-t-0">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--color-border-strong)] text-sm font-semibold transition hover:border-[var(--ink)]">
              <Upload className="h-4 w-4" />
              Upload Room Image
              <input type="file" accept="image/*" onChange={onUpload} className="sr-only" />
            </label>

            {product.images.length > 1 && (
              <div className="mt-6">
                <div className="eyebrow">Product Image</div>
                <div className="mt-3 flex gap-2">
                  {product.images.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setActiveImage(image)}
                      className={`h-16 w-16 overflow-hidden rounded-lg ring-2 ${activeImage === image ? "ring-[var(--oxblood)]" : "ring-transparent"}`}
                    >
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-5">
              <Range label="Horizontal position" value={x} min={20} max={80} onChange={setX} />
              <Range label="Vertical position" value={y} min={18} max={70} onChange={setY} />
              <Range label="Artwork size" value={size} min={18} max={58} onChange={setSize} />
            </div>

            <div className="mt-6">
              <div className="eyebrow">Frame Colour</div>
              <div className="mt-3 flex gap-2">
                {(Object.keys(FRAME_COLORS) as FrameColor[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFrame(key)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border ${frame === key ? "border-[var(--ink)]" : "border-[var(--color-border)]"}`}
                    aria-label={`${key} frame`}
                  >
                    <span
                      className="h-6 w-6 rounded-full border border-black/10"
                      style={{ background: FRAME_COLORS[key] }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSaved(true)} className="btn-primary">
                <Save className="h-4 w-4" /> Save
              </button>
              <button type="button" onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            </div>
            {saved && (
              <p className="mt-3 text-xs font-semibold text-[var(--indigo)]">
                Preview saved for this session.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Range({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        <span>{value}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-[var(--oxblood)]"
      />
    </label>
  );
}
