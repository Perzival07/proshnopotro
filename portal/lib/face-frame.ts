import { brightenIfDark } from "@/lib/low-light";

/**
 * Copies the camera's current frame onto a canvas of a known size, brightened
 * if the room is dark, for the face and phone models to look at.
 *
 * Handing MediaPipe the <video> itself is not safe: on many webcams the frame
 * the browser decodes is larger than the picture it shows (a 16:9 sensor
 * cropped to 4:3, say), and the model then reports boxes in the larger frame's
 * pixels while we divide by the smaller -- the box lands on the shoulder
 * instead of the face. A canvas we size ourselves has one size, and the boxes
 * come back in it.
 *
 * `maxWidth` keeps the copy small: the face model looks at 128x128 anyway,
 * and a smaller copy averages away some of a dark room's sensor noise.
 */
export interface FrameCopier {
  /** The prepared frame, or null if the video has no picture yet. */
  copy(video: HTMLVideoElement): HTMLCanvasElement | null;
}

export function createFrameCopier(maxWidth: number): FrameCopier {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  return {
    copy(video) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      if (!canvas) {
        canvas = document.createElement("canvas");
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      }
      if (!ctx) return null;

      const scale = Math.min(1, maxWidth / vw);
      const width = Math.round(vw * scale);
      const height = Math.round(vh * scale);
      // Resizing clears the canvas, so only when the camera changes shape
      // (a phone turned on its side).
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, width, height);

      const image = ctx.getImageData(0, 0, width, height);
      if (brightenIfDark(image.data)) ctx.putImageData(image, 0, 0);
      return canvas;
    },
  };
}
