import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareImageForUpload, SAFE_IMAGE_UPLOAD_BYTES } from "../src/marketplace/image-upload";
import { uploadResponseResult } from "../src/marketplace/upload-response";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("image upload preparation", () => {
  it("passes images below the serverless payload ceiling through unchanged", async () => {
    const file = new File([new Uint8Array(1024)], "small.jpg", { type: "image/jpeg" });

    await expect(prepareImageForUpload(file)).resolves.toBe(file);
  });

  it("optimizes oversized images before they are sent to the upload endpoint", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const output = new Uint8Array(2 * 1024 * 1024);
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ clearRect: vi.fn(), drawImage })),
      toBlob: vi.fn((callback: BlobCallback, type?: string) => {
        callback(new Blob([output], { type }));
      }),
    };
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 5000, height: 4000, close })),
    );
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });

    const file = new File([new Uint8Array(SAFE_IMAGE_UPLOAD_BYTES + 1)], "large.png", {
      type: "image/png",
      lastModified: 123,
    });
    const prepared = await prepareImageForUpload(file);

    expect(prepared).not.toBe(file);
    expect(prepared.type).toBe("image/webp");
    expect(prepared.name).toBe("large.webp");
    expect(prepared.size).toBeLessThanOrEqual(SAFE_IMAGE_UPLOAD_BYTES);
    expect(canvas.width).toBe(2560);
    expect(canvas.height).toBe(2048);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports a platform payload rejection instead of a false connectivity error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE", {
            status: 413,
            headers: { "content-type": "text/plain" },
          }),
      ),
    );

    const response = await fetch("/api/uploads", { method: "POST", body: new FormData() });
    const result = await uploadResponseResult(response);

    expect(result).toEqual({
      error: {
        code: "FILE_TOO_LARGE",
        message: "This image is too large to upload. Please choose a smaller image.",
      },
    });
  });
});
