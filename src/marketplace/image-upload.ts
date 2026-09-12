const MEBIBYTE = 1024 * 1024;

// Vercel Functions reject the complete request body above 4.5 MB. Keeping the
// file below 4 MiB leaves room for multipart headers and form fields.
export const SAFE_IMAGE_UPLOAD_BYTES = 4 * MEBIBYTE;
const MAX_IMAGE_DIMENSION = 2560;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected image could not be read"));
      image.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The selected image could not be prepared")),
      type,
      quality,
    );
  });
}

function optimizedFilename(filename: string, mimeType: string) {
  const stem = filename.replace(/\.[^.]+$/, "") || "artwork";
  return `${stem}.${mimeType === "image/jpeg" ? "jpg" : "webp"}`;
}

/**
 * Keeps image uploads below serverless request limits without changing the
 * visible upload flow. Small files pass through untouched; only oversized
 * images are resized/re-encoded in the browser.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SAFE_IMAGE_UPLOAD_BYTES) return file;

  const image = await decodeImage(file);
  try {
    if (!image.width || !image.height) throw new Error("The selected image could not be read");

    const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: outputType !== "image/jpeg" });
    if (!context) throw new Error("The selected image could not be prepared");

    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    let quality = 0.9;
    let smallest: Blob | undefined;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

      const blob = await canvasBlob(canvas, outputType, quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= SAFE_IMAGE_UPLOAD_BYTES) {
        return new File([blob], optimizedFilename(file.name, outputType), {
          type: outputType,
          lastModified: file.lastModified,
        });
      }

      if (quality > 0.58) quality -= 0.1;
      else {
        scale *= 0.75;
        quality = 0.82;
      }
    }

    throw new Error(
      smallest && smallest.size < file.size
        ? "This image is still too large after optimization. Please choose a smaller image."
        : "This image is too large to upload. Please choose a smaller image.",
    );
  } finally {
    image.dispose();
  }
}
