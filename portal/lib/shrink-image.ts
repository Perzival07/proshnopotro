import { fitWithin, IMAGE_QUALITY, MAX_IMAGE_EDGE } from "./answer-upload";

/**
 * Shrinks a photo in the browser before it is uploaded: scaled down to
 * MAX_IMAGE_EDGE on its longest side and re-encoded as JPEG at IMAGE_QUALITY.
 * A 12-megapixel phone photo of a page goes from several MB to a few hundred
 * KB and stays readable.
 *
 * `createImageBitmap` honours the photo's EXIF rotation, so a page shot in
 * portrait is not uploaded lying on its side.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  const source = await decode(file);
  const { width, height } = fitWithin(source.width, source.height, MAX_IMAGE_EDGE);
  if (!width || !height) throw new Error("This photo could not be read.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process photos.");

  // JPEG has no transparency; paint white so a PNG screenshot is not black.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.image, 0, 0, width, height);
  source.release();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY)
  );
  if (!blob) throw new Error("This photo could not be compressed.");
  return blob;
}

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Older Safari rejects the options bag; fall through to an <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This file is not a photo this browser can open."));
      el.src = url;
    });
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}
